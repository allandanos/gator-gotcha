/** Nickname rule shared by the client cache and the online module; the database enforces the same check. */
export const NICKNAME_PATTERN = /^[A-Za-z0-9_ ]{3,16}$/;
