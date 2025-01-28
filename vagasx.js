const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const xlsx = require('xlsx');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configuração
const CONFIG = {
    URLs: [
        'https://www.vagas.com.br/vagas-de-sao-paulo-em-sao-paulo?a%5B%5D=11&a%5B%5D=15&a%5B%5D=21&a%5B%5D=130&e%5B%5D=S%C3%A3o+Paulo&h%5B%5D=40&h%5B%5D=30&m%5B%5D=Empresa+e+Home+Office&m%5B%5D=Na+empresa&mo%5B%5D=Regime+CLT',
        // Adicione mais URLs aqui
        'https://www.vagas.com.br/vagas-de-sao-paulo-em-sao-paulo?a%5B%5D=130&e%5B%5D=S%C3%A3o+Paulo&h%5B%5D=40&h%5B%5D=30&m%5B%5D=Empresa+e+Home+Office&m%5B%5D=Na+empresa&mo%5B%5D=Regime+CLT'
    ],
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    TIMEOUT: 60000,
    INITIAL_DELAY: 3000,
    EXCEL_COLUMN_WIDTHS: {
        A: 40, // título
        B: 30, // empresa
        C: 20, // localização
        D: 15, // posição
        E: 25, // quantidade de vagas
        F: 50, // descrição
        G: 40, // link
        H: 15  // publicado em
    }
};

// Setup do navegador e página
async function initializeBrowser() {
    return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
}

async function setupPage(browser) {
    const page = await browser.newPage();
    await page.setUserAgent(CONFIG.USER_AGENT);
    await page.setDefaultNavigationTimeout(CONFIG.TIMEOUT);
    return page;
}

// Extração de dados
async function extractJobData(page) {
    return await page.evaluate(() => {
        const vagaElements = document.querySelectorAll('.vaga');
        return Array.from(vagaElements).map(vaga => ({
            titulo: vaga.querySelector('h2')?.textContent?.trim() || 'Título não disponível',
            empresa: vaga.querySelector('.emprVaga')?.textContent?.trim() || 'Empresa não disponível',
            localizacao: vaga.querySelector('.vaga-local')?.textContent?.trim() || 'Localização não disponível',
            posicao: vaga.querySelector('.nivelVaga')?.textContent?.trim() || 'Posicao não informado',
            qtdeVagas: vaga.querySelector('.qtdPosicoes')?.textContent?.trim() || 'Quantidade de vagas não informado',
            descricao: vaga.querySelector('.detalhes')?.textContent?.trim() || 'Detalhes não informado',
            link: vaga.querySelector('.link-detalhes-vaga')?.href || '',
            publicadoEm: vaga.querySelector('.data-publicacao')?.textContent?.trim() || 'Data não disponível'
        }));
    });
}

// Gerar nomes de arquivos
function generateFileNames() {
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').replace(/:/g, '-').split('.')[0];
    return {
        json: `vagas ${formattedDate}.json`,
        excel: `vagas ${formattedDate}.xlsx`
    };
}

async function saveToJson(data, fileName) {
    await fs.writeFile(fileName, JSON.stringify(data, null, 2));
    console.log(`JSON file saved: ${fileName}`);
}

function saveToExcel(data, fileName) {
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);
    worksheet['!cols'] = Object.entries(CONFIG.EXCEL_COLUMN_WIDTHS).map(([_, width]) => ({ wch: width }));
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Vagas');
    xlsx.writeFile(workbook, fileName);
    console.log(`Excel file saved: ${fileName}`);
}

// Função para buscar empregos em várias URLs
async function searchJobs() {
    const browser = await initializeBrowser();
    let allJobs = [];

    try {
        for (let url of CONFIG.URLs) {
            let page = await setupPage(browser);
            console.log(`Navigating to jobs page: ${url}`);

            await page.goto(url, { waitUntil: 'networkidle0', timeout: CONFIG.TIMEOUT });

            console.log('Waiting for initial load...');
            await delay(CONFIG.INITIAL_DELAY);

            const jobs = await extractJobData(page);

            if (jobs.length === 0) {
                console.log(`No jobs found at ${url}`);
            } else {
                console.log(`Found ${jobs.length} jobs at ${url}`);
                allJobs = allJobs.concat(jobs);
            }

            await page.close();
        }

        if (allJobs.length === 0) {
            throw new Error('No jobs found across all URLs');
        }

        return allJobs;

    } catch (error) {
        throw new Error(`Error during search: ${error.message}`);
    } finally {
        await browser.close();
    }
}

// Função principal
async function main() {
    try {
        console.log('Starting job search...');
        const jobs = await searchJobs();

        const fileNames = generateFileNames();
        await saveToJson(jobs, fileNames.json);
        saveToExcel(jobs, fileNames.excel);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Executar a aplicação
main();
