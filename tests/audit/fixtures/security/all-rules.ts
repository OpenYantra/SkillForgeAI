/**
 * AUD-R05: rule-liveness fixture. Each of the 16 SEC-* rules must find at least
 * one positive match in this file. SEC-004 (hardcoded credential) and
 * SEC-014 (multi-line CORS + credentials) are expected to be missing.
 */

declare const _db: any;
declare const _id: string;
declare const _file: string;
declare const _command: string;
declare const _expression: string;
declare const _payload: any;
declare const _element: any;
declare const _html: string;
declare const crypto: any;
declare const pickle: any;
declare const req: any;
declare function exec(command: string): void;
declare function spawn(command: string, options: any): void;
declare function readFileSync(target: string): unknown;
declare function fetch(target: string): unknown;
declare let token: any;

const _awsKey = 'AKIAIOSFODNN7EXAMPLE';
const _ghToken = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
const _keyHeader = '-----BEGIN RSA PRIVATE KEY-----';
const password = 'S3cr3tP@ssw0rd';
const _query = 'SELECT * FROM users';

_db.query('SELECT * FROM users WHERE id = ' + _id);
exec('convert ' + _file);
spawn(_command, { shell: true });
eval(_expression);
pickle.loads(_payload);
readFileSync(req.query.path);
_element.innerHTML = _html;
crypto.createHash('md5');
token = Math.random();
token = token + 1;
fetch(req.query.url);

const _cors = {
  origin: '*',
  credentials: true,
};

const _tlsAgent = { rejectUnauthorized: false };

void password;
void token;
void _query;
void _cors;
void _tlsAgent;
