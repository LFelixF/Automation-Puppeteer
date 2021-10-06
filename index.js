const puppeteer = require('puppeteer');
const user = require('./user.json');
const banco = require('./banco');
const readline = require('readline');

const fs = require('fs');
let relatorio = [];
let info_processo;

const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const pergunta01 = '> Digite "1" para enviar os processos para os Estágiarios. ';
const pergunta02 = '> Digite "2" para enviar os processos da Caixa de Saida. ';
const pergunta03 = '> Digite "3" para sair. ';

input.question(`Qual operação deseja que o RobozinPJE faça? \n${pergunta01}\n${pergunta02}\n${pergunta03}\n`, (resposta) => {
    if (resposta == 1) {
        console.log('----OPERAÇÃO INICIALIZADA - ENVIO PARA ESTÁGIARIOS----');

        async function main() {
            try {
                // Abrindo o navegador e logando
                const browser = await puppeteer.launch({
                    headless: false
                });

                const page = await browser.newPage();
                await page.setViewport({
                    width: 1050,
                    height: 1000
                });

                await page.goto('https://pje1g.trf3.jus.br/pje/login.seam');
                await page.waitForSelector('form#login', {
                    visible: true,
                })
                await page.waitForSelector('#username.login-usuario');
                await page.type('#username.login-usuario', user.usuario);
                await page.waitForSelector('#password');
                await page.type('#password', user.password);
                await page.click('#btnEntrar.btn.btn.btn-primary.pull-right');

                // Pulando o aviso de entrada do PJE
                await page.waitForSelector('input[name="j_id178:j_id179"]');
                await page.click('input[name="j_id178:j_id179"]');

                // Navegando pelo PJE
                await page.waitForSelector('a[name="formAbaExpediente:listaAgrSitExp:0:j_id147"]');
                await page.click('a[name="formAbaExpediente:listaAgrSitExp:0:j_id147"]');
                await page.waitForSelector('a[name="formAbaExpediente:listaAgrSitExp:0:trPend:19::jNp"]');
                await page.click('a[name="formAbaExpediente:listaAgrSitExp:0:trPend:19::jNp"]');
                await page.waitForSelector('a[name="formAbaExpediente:listaAgrSitExp:0:trPend:19:9535::j_id155:cxExItem"]');
                await page.click('a[name="formAbaExpediente:listaAgrSitExp:0:trPend:19:9535::j_id155:cxExItem"]');
                await page.waitForTimeout(3000);

                // Pegando o número de processos da pasta
                await page.waitForSelector('form[name="formAbaExpediente:listaAgrSitExp:0:trPend:19:9535::j_id155"] > div[class="col-md-1 itemContador"] > span');
                const processos = await page.evaluate(() => {
                    return document.querySelector('form[name="formAbaExpediente:listaAgrSitExp:0:trPend:19:9535::j_id155"] > div[class="col-md-1 itemContador"] > span').textContent;
                });

                console.log(`> Quantidades de processos para envio: ${processos}`);
                let restante = processos;
                
                // Variaveis Loop
                const numero_processos = processos;
                let contador = 0;

                // Data atual
                const data = new Date;
                const dia = data.getDate();
                const mes = data.getMonth() + 1;
                const ano = data.getFullYear();
                
                // Variaveis para o envio dos estagiarios
                var enviado = false;
                var estag_numero = 0;

                // Loop de envio
                while (contador < numero_processos) {
                    contador++;

                    await page.waitForTimeout(2000);
                    await page.waitForSelector('.numero-processo-expediente', {
                        visible: true,
                    });

                    //pegando o identificador/destinario do processo
                    const [popup] = await Promise.all([
                        new Promise(resolve => page.once('popup', resolve)),
                        page.click('.numero-processo-expediente'),
                    ]);

                    const pageCNPJ = await popup;
                    await pageCNPJ.waitForSelector('#navbar > ul > li > a.titulo-topo.dropdown-toggle.titulo-topo-desktop');
                    await pageCNPJ.click('#navbar > ul > li > a.titulo-topo.dropdown-toggle.titulo-topo-desktop');
                    await pageCNPJ.waitForSelector('#poloPassivo > table > tbody > tr > td > span > span');

                    let destinatario = await pageCNPJ.evaluate(() => {
                        return document.querySelector('#poloPassivo > table > tbody > tr > td > span > span').textContent;
                    });

                    await pageCNPJ.close();

                    let exfis = await page.evaluate(() => {
                        return document.querySelector('.numero-processo-expediente').textContent;
                    });

                    // Manipulando os processos
                    await page.waitForSelector('input[title="Selecionar"]');
                    await page.click('input[title="Selecionar"]');
                    await page.waitForSelector('#moverPara');
                    await page.click('#moverPara');

                    // Controle de envio para as pastas dos estagiarios
                    while (enviado == false) {
                        if (banco[estag_numero].ferias != mes && estag_numero < banco.length) {
                            // Modal de envio
                            await page.waitForSelector('#modalMoverPara');
                            await page.waitForSelector('select[name="frmMoverPara:cxDestino"]', {
                                visible: true,
                            });
                            await page.select('select[name="frmMoverPara:cxDestino"]', `${banco[estag_numero].caixa}`);
                            await page.click('input[value="Mover expedientes"]');
                            await page.waitForSelector('#modalMessage > div > div > div.modal-header > span > a', {
                                visible: true,
                            });
                            await page.waitForSelector('#modalMessage > div > div > div.modal-header > span > a');
                            await page.click('#modalMessage > div > div > div.modal-header > span > a');

                            enviado = true;
                        } 
                        else if (estag_numero < banco.length-1){
                            estag_numero++;
                        }
                        else {
                            estag_numero = 0
                        };
                    };

                    info_processo = `\nEstagiario: ${banco[estag_numero].nome}\nDestinatario: ${destinatario}  \nExFis: ${exfis}\n`;
                    relatorio.push(info_processo);

                    enviado = false;

                    if (estag_numero < banco.length-1) {
                        estag_numero++;
                    }
                    else {
                        estag_numero = 0;
                    };

                    restante--;
                    console.log(`Faltam ${restante} processos.`);
                };

                await page.waitForTimeout(5000);
                await browser.close();

                const relatorio_final = relatorio.join(' ');

                fs.appendFile(`./Relatórios/${dia}-${mes}-${ano}.txt`, relatorio_final, (err) => {
                    if (err) {
                        console.log('Erro na criação do arquivo de texto, erro no relatório.');
                    }
                });

                console.log('----FINALIZADO! PROCESSOS ENVIADOS----');
            } catch {
                console.error('ERROR');
            };
        };

        main();
    }
    else if (resposta == 2) {
        console.log('----EM DESENVOLVIMENTO----');
    }
    else {
        console.log('----SAIU----')
    }

    input.close();
});