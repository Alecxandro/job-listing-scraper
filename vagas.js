const puppeteer = require('puppeteer');
const fs = require('fs');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const xlsx = require('xlsx');
async function buscarVagasInfoJobs() {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ]
    });

    try {
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Navegando para o Vagas...');
        const url = 'https://www.vagas.com.br/vagas-de-sao-paulo?a%5B%5D=10&a%5B%5D=21&e%5B%5D=S%C3%A3o+Paulo&h%5B%5D=22&h%5B%5D=40&m%5B%5D=Empresa+e+Home+Office&m%5B%5D=Na+empresa&mo%5B%5D=Regime+CLT'
        
        await page.setDefaultNavigationTimeout(60000);

        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        console.log('Aguardando carregamento inicial...');
        await delay(3000);

        // Extrai as vagas
        const vagas = await page.evaluate(() => {
            const vagaElements = document.querySelectorAll('.vaga');
            return Array.from(vagaElements).map(vaga => {
                return {
                    titulo: vaga.querySelector('h2')?.textContent.trim() || 'Título não disponível',
                    empresa: vaga.querySelector('.emprVaga')?.textContent.trim() || 'Empresa não disponível',
                    localizacao: vaga.querySelector('.vaga-local')?.textContent.trim() || 'Localização não disponível',
                    posicao: vaga.querySelector('.nivelVaga')?.textContent.trim() || 'Posicao não informado',
                    qtdeVagas: vaga.querySelector('.qtdPosicoes')?.textContent.trim() || 'Quantidade de vagas não informado',
                    descricao: vaga.querySelector('.detalhes')?.textContent.trim() || 'Detalhes não informado',
                    link: vaga.querySelector('.link-detalhes-vaga')?.href || '',
                    publicadoEm: vaga.querySelector('.data-publicacao')?.textContent.trim() || 'Data não disponível'
                };
            });
        });

        if (vagas.length === 0) {
            throw new Error('Nenhuma vaga encontrada');
        }

        console.log(`Encontradas ${vagas.length} vagas!`);
        return vagas;

    } catch (error) {
        throw new Error(`Erro durante a busca: ${error.message}`);
    } finally {
        await browser.close();
    }
}

(async () => {
    try {
        console.log('Iniciando busca de vagas...');
        const vagas = await buscarVagasInfoJobs();
        console.log('\nVagas encontradas:');
       
        
        const now = new Date();
        const formattedDate = now.toISOString().replace('T', ' ').replace(/:/g, '-').split('.')[0];
        const jsonFileName = `vagas ${formattedDate}.json`;
        const excelFileName = `vagas ${formattedDate}.xlsx`;

        
        fs.writeFileSync(jsonFileName, JSON.stringify(vagas, null, 2));
        console.log(`Vagas salvas em ${jsonFileName}`);

        
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(vagas);

        
        const colWidths = {
            A: 40, // título
            B: 30, // empresa
            C: 20, // localização
            D: 15, // posição
            E: 25, // quantidade de vagas
            F: 50, // descrição
            G: 40, // link
            H: 15  // publicado em
        };

        worksheet['!cols'] = Object.keys(colWidths).map(key => ({
            wch: colWidths[key]
        }));

        
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Vagas');

        
        xlsx.writeFile(workbook, excelFileName);
        console.log(`Excel file created successfully: ${excelFileName}`);
        
    } catch (error) {
        console.error('Erro ao buscar vagas:', error.message);
    }
})();