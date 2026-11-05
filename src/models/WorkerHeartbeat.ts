import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWorkerHeartbeat {
  workerName: string;
  isRunning: boolean;
  activeIngests: number;
  lastPingAt: Date;
  metadata?: Record<string, any>;
}

export interface IWorkerHeartbeatDocument extends IWorkerHeartbeat, Document {}

const WorkerHeartbeatSchema = new Schema<IWorkerHeartbeatDocument>(
  {
    workerName: { type: String, required: true, default: 'Mac-Worker' },
    isRunning: { type: Boolean, default: true },
    activeIngests: { type: Number, default: 0 },
    lastPingAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const WorkerHeartbeat: Model<IWorkerHeartbeatDocument> =
  mongoose.models.WorkerHeartbeat || mongoose.model<IWorkerHeartbeatDocument>('WorkerHeartbeat', WorkerHeartbeatSchema);

