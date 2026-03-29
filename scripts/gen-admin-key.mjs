#!/usr/bin/env node
/**
 * Gera uma chave aleatória para ADMIN_API_KEY (backend) e VITE_ADMIN_API_KEY (frontend).
 * Uso: node scripts/gen-admin-key.mjs   ou   npm run gen:admin-key
 */
import crypto from 'crypto';

const key = crypto.randomBytes(32).toString('hex');

console.log('');
console.log('Copie as linhas abaixo para os ficheiros .env (mesmo valor nas duas):');
console.log('');
console.log('# backend/.env');
console.log(`ADMIN_API_KEY=${key}`);
console.log('');
console.log('# frontend/.env');
console.log(`VITE_ADMIN_API_KEY=${key}`);
console.log('');
console.log('Depois: reinicie o backend e o Vite (npm run dev).');
console.log('');
