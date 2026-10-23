/* Novetus current URI format verified against upstream LocalFuncs.cs and
   NovetusFuncs.LoadServerInformation(): base64(base64(ip)|base64(port)|base64(client)). */
(function (root) {
  'use strict';
  const marker = 'BLOCKPLACES_V1';
  function ipv4(value) {
    return typeof value === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every(p => Number(p) <= 255 && String(Number(p)) === p);
  }
  function imageURL(value) {
    if (!value) return '';
    if (typeof value !== 'string' || value.length > 1000) throw new Error('Ссылка на картинку слишком длинная.');
    let u; try { u = new URL(value); } catch (_) { throw new Error('Укажи полную HTTPS-ссылку на картинку.'); }
    if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Для картинки нужна HTTPS-ссылка без логина и пароля.');
    return u.href;
  }
  function validate(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Некорректные данные плейса.');
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name || name.length > 80) throw new Error('Название: от 1 до 80 символов.');
    const host = typeof raw.host === 'string' ? raw.host.trim() : '';
    if (!ipv4(host) && host !== 'localhost') throw new Error('Введи IPv4 без http:// и без порта: например 123.45.67.89.');
    const port = Number(raw.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Порт должен быть числом от 1 до 65535.');
    const client = typeof raw.client === 'string' ? raw.client.trim() : '';
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_. -]{0,39}$/.test(client) || client.includes('..')) throw new Error('Укажи имя клиента Novetus, например 2011M, без путей и специальных символов.');
    const description = typeof raw.description === 'string' ? raw.description.trim() : '';
    if (description.length > 350) throw new Error('Описание: не больше 350 символов.');
    const uri = typeof raw.uri === 'string' ? raw.uri.trim() : '';
    if (uri && (!/^novetus:\/\/[A-Za-z0-9+/]+={0,2}\/?$/.test(uri) || uri.length > 2048)) throw new Error('Готовая ссылка должна начинаться с novetus:// и содержать только данные ссылки Novetus.');
    return { name, host, port, client, image: imageURL(raw.image), description, uri };
  }
  function encode64(s) { return btoa(s); } // IP, numeric port and client identifiers are ASCII.
  function makeURI(raw) {
    const p = validate(raw);
    return p.uri || 'novetus://' + encode64([p.host, String(p.port), p.client].map(encode64).join('|'));
  }
  function issueBody(raw) { return marker + '\n```json\n' + JSON.stringify(validate(raw), null, 2) + '\n```'; }
  function parseIssue(issue) {
    try {
      if (!issue || issue.pull_request || issue.state !== 'open' || !issue.title?.startsWith('[Place] ') || typeof issue.body !== 'string' || issue.body.length > 12000 || !Number.isInteger(issue.number) || !/^[a-zA-Z0-9-]+$/.test(issue.user?.login || '')) return null;
      const m = issue.body.match(/^BLOCKPLACES_V1\s*\n```json\s*\n([\s\S]*?)\n```\s*$/);
      if (!m) return null;
      return { ...validate(JSON.parse(m[1])), id: issue.number, author: issue.user.login };
    } catch (_) { return null; }
  }
  const api = { marker, ipv4, validate, makeURI, issueBody, parseIssue };
  root.PlacesCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
