import {createECDH,randomBytes} from 'node:crypto';
const key=createECDH('prime256v1');key.generateKeys();
console.log('VAPID_PUBLIC_KEY='+key.getPublicKey().toString('base64url'));
console.log('VAPID_PRIVATE_KEY='+key.getPrivateKey().toString('base64url'));
console.log('CRON_SECRET='+randomBytes(32).toString('base64url'));
console.log('Keep the private key and cron secret in Supabase secrets and out of Git.');
