import mongoose, { Schema } from 'mongoose';

const VotanteSchema = new Schema({
  fingerprint: { type: String, required: true, unique: true },
  ip: { type: String, required: true },
  nombre: { type: String, required: false },
  candidatoId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const VotoTotalSchema = new Schema({
  candidatoId: { type: String, required: true, unique: true },
  total: { type: Number, default: 0 }
});

const SecurityLogSchema = new Schema({
  ip: { type: String, required: true, index: true },
  type: { type: String, enum: ['vote_cooldown', 'failed_attempt'], required: true },
  timestamp: { type: Date, default: Date.now, expires: 86400 }
});

export const Votante = mongoose.model('Votante', VotanteSchema);
export const VotoTotal = mongoose.model('VotoTotal', VotoTotalSchema);
export const SecurityLog = mongoose.model('SecurityLog', SecurityLogSchema);
