import { Schema, model, Document } from 'mongoose';

interface IUser extends Document {
    email: string;
    passwordHash: string;
    monthlyBudgetGoal: number; // in KSH
    socketId?: string; // for real-time updates
}

const UserSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    monthlyBudgetGoal: { type: Number, default: 0 },
    socketId: { type: String }
});

export const User = model<IUser>('User', UserSchema);
