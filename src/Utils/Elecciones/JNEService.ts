import axios from 'axios';

export class JNEService {
    private static BASE = 'https://web.jne.gob.pe/serviciovotoinformado/api/votoinf';
    private static HEAD = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://votoinformado.jne.gob.pe/',
        'Origin': 'https://votoinformado.jne.gob.pe',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };

    static async list(): Promise<any[]> {
        const r = await axios.post(`${this.BASE}/listarCanditatos`, { idProcesoElectoral: 124, strUbiDepartamento: "", idTipoEleccion: 1 }, { headers: this.HEAD, timeout: 10000 });
        return r.data.data || [];
    }

    static async plans(): Promise<any[]> {
        const r = await axios.post(`${this.BASE}/plangobierno`, { pageSize: 100, skip: 1, filter: { idProcesoElectoral: 124, idTipoEleccion: "1", idOrganizacionPolitica: "0", txDatoCandidato: "", idJuradoElectoral: "0" } }, { headers: this.HEAD, timeout: 10000 });
        return r.data.data || [];
    }

    static async detail(id: number): Promise<any> {
        const r = await axios.get(`${this.BASE}/detalle-plangobierno?IdPlanGobierno=${id}`, { headers: this.HEAD, timeout: 10000 });
        return r.data;
    }
}
