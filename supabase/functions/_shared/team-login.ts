export const usernameDomain = '@alutim012.local';
export const usernamePattern = /^[a-z0-9._-]{3,32}$/;
export const usernameHint = 'Korisničko ime treba da ima 3–32 znaka. Dozvoljeni su slova a–z, brojevi, tačka, crtica i donja crta.';

export function loginEmail(identifier: string) {
 const login = identifier.trim().toLowerCase();
 return login.includes('@') ? login : `${login}${usernameDomain}`;
}

export function canChangeLoginIdentifier(isAdmin: boolean, email: string | null, nextEmail = email) {
 return isAdmin || (email?.endsWith(usernameDomain) === true && nextEmail?.endsWith(usernameDomain) === true);
}
