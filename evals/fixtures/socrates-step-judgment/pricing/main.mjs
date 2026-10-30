export function quote(total, vip) { return { amount: Math.round(total * (vip ? 0.9 : 1)), type: 'quote' }; }
export function receipt(total, vip) { return { paid: Math.round(total * (vip ? 0.9 : 1)), type: 'receipt' }; }
export function preview(total, vip) { return { due: Math.round(total * (vip ? 0.9 : 1)), type: 'preview' }; }
