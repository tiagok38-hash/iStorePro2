const fs = require('fs');

// 1. Generate useOrcamentoForm.ts
const saleFormPath = './hooks/useSaleForm.ts';
let saleFormContent = fs.readFileSync(saleFormPath, 'utf8');

saleFormContent = saleFormContent.replace(/UseSaleFormProps/g, 'UseOrcamentoFormProps');
saleFormContent = saleFormContent.replace(/useSaleForm/g, 'useOrcamentoForm');
saleFormContent = saleFormContent.replace(/onSaleSaved/g, 'onOrcamentoSaved');
saleFormContent = saleFormContent.replace(/saleToEdit/g, 'orcamentoToEdit');
saleFormContent = saleFormContent.replace(/addSale/g, 'createOrcamento');
saleFormContent = saleFormContent.replace(/updateSale/g, 'updateOrcamento');
saleFormContent = saleFormContent.replace(/Sale/g, 'Orcamento');
saleFormContent = saleFormContent.replace(/saleDate/g, 'orcamentoDate');
saleFormContent = saleFormContent.replace(/setSaleDate/g, 'setOrcamentoDate');
saleFormContent = saleFormContent.replace(/baseSaleData/g, 'baseOrcamentoData');
saleFormContent = saleFormContent.replace(/\.\/services\/mockApi\.ts/g, '../services/orcamentosService.ts');

fs.writeFileSync('./hooks/useOrcamentoForm.ts', saleFormContent);

// 2. Generate NewOrcamentoView.tsx
const saleViewPath = './components/pos/NewSaleView.tsx';
let saleViewContent = fs.readFileSync(saleViewPath, 'utf8');

saleViewContent = saleViewContent.replace(/NewSaleViewProps/g, 'NewOrcamentoViewProps');
saleViewContent = saleViewContent.replace(/NewSaleView/g, 'NewOrcamentoView');
saleViewContent = saleViewContent.replace(/useSaleForm/g, 'useOrcamentoForm');
saleViewContent = saleViewContent.replace(/saleToEdit/g, 'orcamentoToEdit');
saleViewContent = saleViewContent.replace(/onSaleSaved/g, 'onOrcamentoSaved');
saleViewContent = saleViewContent.replace(/saleDate/g, 'orcamentoDate');
saleViewContent = saleViewContent.replace(/setSaleDate/g, 'setOrcamentoDate');
saleViewContent = saleViewContent.replace(/Nova Venda/g, 'Novo Orçamento');
saleViewContent = saleViewContent.replace(/Venda/g, 'Orçamento');
saleViewContent = saleViewContent.replace(/venda/g, 'orçamento');
saleViewContent = saleViewContent.replace(/success-light/g, 'orange-100');
saleViewContent = saleViewContent.replace(/success-dark/g, 'orange-600');
saleViewContent = saleViewContent.replace(/success/g, 'orange-500'); // replacing success colors with orange
saleViewContent = saleViewContent.replace(/text-emerald-700/g, 'text-orange-700');
saleViewContent = saleViewContent.replace(/bg-emerald-50/g, 'bg-orange-50');
saleViewContent = saleViewContent.replace(/border-emerald-100/g, 'border-orange-100');

fs.writeFileSync('./components/orcamentos/NewOrcamentoView_v2.tsx', saleViewContent);

console.log("Done generating base files. Need manual refinements now.");
