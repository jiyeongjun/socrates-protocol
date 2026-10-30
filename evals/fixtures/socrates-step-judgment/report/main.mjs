import {serialize} from './formatter.mjs';
export function download(rows) { return { contentType:'application/json', body:serialize(rows) }; }
