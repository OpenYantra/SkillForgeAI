import crypto from 'node:crypto';

// AUD-R06: MEDIUM severity weakness (broken hash algorithm).
export function hashPassword(password: string): string {
  return crypto.createHash('md5').update(password).digest('hex');
}
