import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SyncOp, UserData } from "../types";

const ACCOUNTS = "bp.accounts.v1";
const SESSION = "bp.session.v1";

export interface Account {
  email: string;
  password: string;
  userId: string;
  data: UserData;
  queue: SyncOp[];
}

export interface Session {
  userId: string;
  email: string;
}

function shadowKey(userId: string): string {
  return `bp.shadow.v1.${userId}`;
}

export async function loadAccounts(): Promise<Account[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Account[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function saveAccounts(accounts: Account[]): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS, JSON.stringify(accounts));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION);
  if (!raw) return null;
  return JSON.parse(raw) as Session;
}

export async function saveSession(session: Session | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(SESSION);
    return;
  }
  await AsyncStorage.setItem(SESSION, JSON.stringify(session));
}

export async function loadShadow(userId: string): Promise<UserData | null> {
  const raw = await AsyncStorage.getItem(shadowKey(userId));
  return raw ? (JSON.parse(raw) as UserData) : null;
}

export async function saveShadow(userId: string, data: UserData): Promise<void> {
  await AsyncStorage.setItem(shadowKey(userId), JSON.stringify(data));
}
