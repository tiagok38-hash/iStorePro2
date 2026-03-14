const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'pages/Company.tsx');
let content = fs.readFileSync(srcFile, 'utf8');
const lines = content.split('\n');

const compDir = path.join(__dirname, 'pages/Company');
if (!fs.existsSync(compDir)) fs.mkdirSync(compDir);

const importsEnd = 46;
let baseImports = lines.slice(0, importsEnd).join('\n');

// Adjust imports to account for moving one directory deep
baseImports = baseImports.replace(/from '\.\.\//g, 'from \'../../');
baseImports = baseImports.replace(/from '\.\//g, 'from \'../');

// Function to get lines
const getLines = (start, end) => lines.slice(start - 1, end).join('\n');

const tabs = [
    { name: 'DadosEmpresaTab', content: getLines(51, 222) },
    { name: 'MarcasECategoriasTab', content: getLines(225, 591) + '\n\n' + getLines(2100, 2169) },
    { name: 'AuditoriaTab', content: getLines(595, 1078) },
    { name: 'BackupRestauracaoTab', content: getLines(1286, 1432) },
    { name: 'ParametrosTab', content: getLines(1083, 1284) + '\n\n' + getLines(1435, 1562) },
    { name: 'MeiosDePagamentoTab', content: getLines(1566, 1705) },
    { name: 'PerfilTab', content: getLines(1708, 1946) },
    { name: 'FuncionariosTab', content: getLines(1949, 2009) }
];

tabs.forEach(tab => {
    const fileContent = `${baseImports}\n\n${tab.content}\n\nexport default ${tab.name};\n`;
    fs.writeFileSync(path.join(compDir, `${tab.name}.tsx`), fileContent);
    console.log(`Created ${tab.name}.tsx`);
});

const companyComponent = getLines(2012, 2171); // 'export default Company;' includes at 2171

// Now overwrite Company.tsx
const newCompanyContent = `${lines.slice(0, 46).join('\n')}

// Import Tabs
import DadosEmpresaTab from './Company/DadosEmpresaTab';
import MarcasECategoriasTab from './Company/MarcasECategoriasTab';
import AuditoriaTab from './Company/AuditoriaTab';
import BackupRestauracaoTab from './Company/BackupRestauracaoTab';
import ParametrosTab from './Company/ParametrosTab';
import MeiosDePagamentoTab from './Company/MeiosDePagamentoTab';
import PerfilTab from './Company/PerfilTab';
import FuncionariosTab from './Company/FuncionariosTab';

${companyComponent.slice(0, companyComponent.indexOf('// --- HELPER MODAL COMPONENT ---'))}
export default Company;
`;

fs.writeFileSync(srcFile, newCompanyContent);
console.log('Updated Company.tsx');
