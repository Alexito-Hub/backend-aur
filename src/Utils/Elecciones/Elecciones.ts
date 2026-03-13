import { Votante, VotoTotal, SecurityLog } from '../../Models/Elecciones/Elecciones';
import { CANDS, CONF } from '../../Config/Elecciones/Elecciones';
import { JNEService } from './JNEService';
import mongoose from 'mongoose';
import crypto from 'crypto';

export default new class Srv {
    private tks = new Set<string>();

    public tk(): string {
        const t = crypto.randomBytes(32).toString('hex');
        this.tks.add(t);
        setTimeout(() => this.tks.delete(t), CONF.EXP);
        return t;
    }

    public vfy(t: string): boolean {
        if (this.tks.has(t)) {
            this.tks.delete(t);
            return true;
        }
        return false;
    }

    public async bad(ip: string) {
        await new SecurityLog({ ip, type: 'fail' }).save();
    }

    public async ok(ip: string): Promise<boolean> {
        const w = new Date(Date.now() - CONF.WIN);
        const c = await SecurityLog.countDocuments({ ip, type: 'fail', timestamp: { $gte: w } });
        return c < CONF.MAX;
    }

    public async vote(cid: string, fp: string, ip: string, name: string) {
        const s = await mongoose.startSession();
        s.startTransaction();
        try {
            if (await Votante.findOne({ fingerprint: fp }).session(s)) {
                await s.abortTransaction();
                return { status: false, msg: 'Ya votaste.' };
            }
            const old = await Votante.findOne({ ip }).session(s);
            if (old) {
                const d = Date.now() - old.timestamp.getTime();
                if (d < CONF.COOL) {
                    await s.abortTransaction();
                    return { status: false, msg: 'Espera un momento.' };
                }
            }
            await new Votante({ fingerprint: fp, ip, nombre: name, candidatoId: cid }).save({ session: s });
            await VotoTotal.findOneAndUpdate({ candidatoId: cid }, { $inc: { total: 1 } }, { upsert: true, session: s });
            await s.commitTransaction();
            return { status: true };
        } catch (e) {
            await s.abortTransaction();
            return { status: false, msg: 'Error de proceso.' };
        } finally {
            s.endSession();
        }
    }

    public async res() {
        try {
            const vts = await VotoTotal.find({});
            const map: Record<string, number> = {};
            vts.forEach(v => { map[v.candidatoId] = v.total; });
            const sum = Object.values(map).reduce((a, b) => a + b, 0);

            let jne: any[] = [], pls: any[] = [];
            try { [jne, pls] = await Promise.all([JNEService.list(), JNEService.plans()]); } catch (e) {}

            const out = jne.filter(j => j.idCargo === 1).map(j => {
                const c = CANDS.find(x => x.pid === j.idOrganizacionPolitica);
                const id = c?.id || `jne_${j.idOrganizacionPolitica}`;
                const n = `${j.strNombres} ${j.strApellidoPaterno} ${j.strApellidoMaterno}`;
                const v = map[id] || 0;
                const p = pls.find(x => x.idOrganizacionPolitica === j.idOrganizacionPolitica);

                return {
                    id,
                    nombre: n,
                    partido: j.strOrganizacionPolitica,
                    votos: v,
                    porcentaje: sum > 0 ? +((v / sum) * 100).toFixed(1) : 0,
                    enc: c?.enc || 0,
                    sim: c?.sim || 0,
                    image: `https://mpesije.jne.gob.pe/apidocs/${j.strGuidFoto}.${j.idOrganizacionPolitica === 1366 ? 'jpeg' : 'jpg'}`,
                    logo: `https://sroppublico.jne.gob.pe/Consulta/Simbolo/GetSimbolo/${j.idOrganizacionPolitica}`,
                    ideo: c?.ideo || 'Independiente',
                    color: c?.color || '#64748b',
                    initials: n.split(' ').map(x => x[0]).join('').substring(0, 3).toUpperCase(),
                    links: p ? [
                        { l: 'Plan (PDF)', u: p.txRutaCompleto },
                        { l: 'JNE', u: `https://votoinformado.jne.gob.pe/perfil/${j.strDocumentoIdentidad || ""}` }
                    ] : [{ l: 'JNE', u: 'https://plataformaelectoral.jne.gob.pe/' }],
                    props: []
                };
            });

            return { candidatos: out.sort((a, b) => b.votos - a.votos || b.enc - a.enc), total: sum, timestamp: Date.now() };
        } catch (e) { throw e; }
    }

    public async det(id: string) {
        const pid = id.startsWith('jne_') ? parseInt(id.replace('jne_', '')) : CANDS.find(c => c.id === id)?.pid;
        if (!pid) return { status: false };
        try {
            const pls = await JNEService.plans();
            const p = pls.find(x => x.idOrganizacionPolitica === pid);
            if (!p) return { status: false };
            const d = await JNEService.detail(p.idPlanGobierno);
            const r: string[] = [];
            if (d.dimensionSocial) r.push(...d.dimensionSocial.slice(0, 2).map((x: any) => x.txPgObjetivo.split('\n')[0]));
            if (d.dimensionEconomica) r.push(...d.dimensionEconomica.slice(0, 2).map((x: any) => x.txPgObjetivo.split('\n')[0]));
            if (d.dimensionAmbiental) r.push(...d.dimensionAmbiental.slice(0, 1).map((x: any) => x.txPgObjetivo.split('\n')[0]));
            return { status: true, props: r.length > 0 ? r : ["No disponible."] };
        } catch (e) { return { status: false }; }
    }

    public async rst() {
        await Promise.all([Votante.deleteMany({}), VotoTotal.deleteMany({}), SecurityLog.deleteMany({})]);
        this.tks.clear();
    }
}
