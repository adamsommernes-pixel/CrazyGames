import Dexie, { type EntityTable } from 'dexie';
import { AuthError, MIN_PASSWORD, validateSignUp, type AuthBackend, type AuthUser } from './types';
import { hashPassword, newSalt, safeEqual } from './crypto';
import { userDbName } from '../db/dexie';

interface Account {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  created_at: string;
}

class AccountsDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  session!: EntityTable<{ key: string; user_id: string }, 'key'>;
  constructor() {
    super('gym-accounts');
    this.version(1).stores({ accounts: 'id, &email', session: 'key' });
  }
}

const toUser = (a: Account): AuthUser => ({ id: a.id, email: a.email, name: a.name, kind: 'local', created_at: a.created_at });
const norm = (email: string) => email.trim().toLowerCase();

/** Kontoer som bare finnes på denne enheten. Brukes når appen ikke har en server. */
export function createLocalBackend(): AuthBackend {
  const adb = new AccountsDB();

  async function verify(email: string, password: string): Promise<Account> {
    const acc = await adb.accounts.where('email').equals(norm(email)).first();
    // Regn ut en hash også når kontoen ikke finnes, så svartiden ikke røper hvilke e-poster som er registrert.
    const hash = await hashPassword(password, acc?.salt ?? newSalt());
    if (!acc || !safeEqual(hash, acc.hash)) throw new AuthError('Feil e-post eller passord.');
    return acc;
  }

  return {
    kind: 'local',

    async current() {
      const s = await adb.session.get('current');
      if (!s) return null;
      const acc = await adb.accounts.get(s.user_id);
      return acc ? toUser(acc) : null;
    },

    async signUp(name, email, password) {
      validateSignUp(name, email, password);
      if (await adb.accounts.where('email').equals(norm(email)).count()) {
        throw new AuthError('Det finnes allerede en konto med denne e-posten på enheten. Logg inn i stedet.');
      }
      const salt = newSalt();
      const acc: Account = {
        id: crypto.randomUUID(),
        email: norm(email),
        name: name.trim(),
        salt,
        hash: await hashPassword(password, salt),
        created_at: new Date().toISOString(),
      };
      await adb.accounts.add(acc);
      await adb.session.put({ key: 'current', user_id: acc.id });
      return toUser(acc);
    },

    async signIn(email, password) {
      const acc = await verify(email, password);
      await adb.session.put({ key: 'current', user_id: acc.id });
      return toUser(acc);
    },

    async signOut() {
      await adb.session.delete('current');
    },

    async changePassword(oldPassword, newPassword) {
      const s = await adb.session.get('current');
      const acc = s && (await adb.accounts.get(s.user_id));
      if (!acc) throw new AuthError('Du er ikke logget inn.');
      await verify(acc.email, oldPassword).catch(() => {
        throw new AuthError('Nåværende passord er feil.');
      });
      if (newPassword.length < MIN_PASSWORD) throw new AuthError(`Nytt passord må ha minst ${MIN_PASSWORD} tegn.`);
      const salt = newSalt();
      await adb.accounts.put({ ...acc, salt, hash: await hashPassword(newPassword, salt) });
    },

    async deleteAccount(password) {
      const s = await adb.session.get('current');
      const acc = s && (await adb.accounts.get(s.user_id));
      if (!acc) throw new AuthError('Du er ikke logget inn.');
      await verify(acc.email, password).catch(() => {
        throw new AuthError('Passordet er feil.');
      });
      await adb.accounts.delete(acc.id);
      await adb.session.delete('current');
      await Dexie.delete(userDbName(acc.id));
    },
  };
}
