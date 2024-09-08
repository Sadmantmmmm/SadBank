async function stopQRCodeScanner() {
    const qrVideo = document.getElementById('qr-video');
    const qrScannerSection = document.getElementById('qrScannerSection');
    const cancelButton = document.getElementById('cancelButton');
    isScanning = false;
    if (qrVideo && qrVideo.srcObject) {
        const tracks = qrVideo.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        qrVideo.srcObject = null;
    }
    
    if (qrVideo) {
        // Ocultar o vídeo e redefinir seus estilos
        qrVideo.style.display = 'none';
        qrVideo.style.position = '';
        qrVideo.style.zIndex = '';
    }
    
    if (qrScannerSection) {
        // Ocultar a seção do scanner
        qrScannerSection.classList.add('hidden');
    }
}
// Variável global para controlar o estado do scanner
let isScanning = false;
document.addEventListener('DOMContentLoaded', () => {
const qrVideo = document.getElementById('qr-video');
const qrScannerSection = document.getElementById('qrScannerSection');
async function startQRCodeScanner() {
    // Se já estiver escaneando, não faça nada
    if (isScanning) {
        console.log('Scanner já está em execução.');
        return;
    }

    const qrVideo = document.getElementById('qr-video');
    const qrScannerSection = document.getElementById('qrScannerSection');
    const scanButton = document.getElementById('scanQRButton');

    try {
        isScanning = true;
        scanButton.disabled = true; // Desabilita o botão enquanto inicializa

        // Certifique-se de que o scanner anterior foi completamente parado
        await stopQRCodeScanner();

        // Exibir a seção do scanner
        if (qrScannerSection) {
            qrScannerSection.classList.remove('hidden');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

        qrVideo.srcObject = stream;

        // Definir o estilo do vídeo para garantir que ele seja visível e posicionado corretamente
        qrVideo.style.display = 'block';
        qrVideo.style.position = 'relative';
        qrVideo.style.zIndex = '1';

        await qrVideo.play();

        // Iniciar o processo de escaneamento
        requestAnimationFrame(scanQRCode);
    } catch (error) {
        console.error('Erro ao acessar a câmera:', error);
        showCustomNotification('Não foi possível acessar a câmera. Verifique as permissões.');
        isScanning = false;
    } finally {
        scanButton.disabled = false; // Reabilita o botão após a inicialização
    }
}
    // Função para gerar QR Code PIX
async function generateQRCode() {
    const amount = document.getElementById('qr-text').value.trim();
    
    if (!amount || isNaN(amount)) {
        showCustomNotification('Por favor, insira um valor válido para gerar o QR Code.');
        return;
    }
    
    try {
        const response = await fetch(`/user/info/${userId}`);
        const data = await response.json();
        const pixKey = await getPixKey();
        const userName = data.username; // Nova função para obter o nome do usuário
        
        if (!pixKey || !userName) {
            showCustomNotification('Não foi possível obter as informações necessárias.');
            return;
        }
        
        const qrCodeData = `${pixKey}|${amount}|${userName}`;
        const qrCodeURL = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCodeData)}&size=256x256`;
        
        const img = document.createElement('img');
        img.src = qrCodeURL;
        document.getElementById('qr-code').innerHTML = '';
        document.getElementById('qr-code').appendChild(img);
        
    } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
        showCustomNotification('Erro ao gerar QR Code: ' + error.message);
    }
}

// Função para ler QR Code PIX
async function scanQRCode() {
    if (isScanning) return;
    if (qrVideo.videoWidth > 0 && qrVideo.videoHeight > 0 && qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = qrVideo.videoWidth;
        canvas.height = qrVideo.videoHeight;
        context.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });

        if (code) {
            const [pixKey, amount, senderName] = code.data.split('|');
            
            if (pixKey && amount && senderName) {
                // Parar o scanner
                stopQRCodeScanner();
                
                // Mostrar tela de confirmação
                showConfirmationScreen(pixKey, amount, senderName);
            } else {
                showCustomNotification('QR Code inválido.');
                requestAnimationFrame(scanQRCode); // Continuar escaneando
            }
        } else {
            requestAnimationFrame(scanQRCode); // Continuar escaneando
        }
    } else {
        setTimeout(scanQRCode, 100);
    }
}

// Função para mostrar a tela de confirmação
function showConfirmationScreen(pixKey, amount, senderName) {
    document.getElementById('confirmationSection').classList.remove('hidden');
    document.getElementById('confirmationSenderName').textContent = senderName;
    document.getElementById('confirmationAmount').textContent = `R$ ${amount}`;
    document.getElementById('confirmationPixKey').textContent = pixKey;
    
    // Ocultar outras seções
    document.querySelectorAll('.tab-content').forEach(tab => {
        if (tab.id !== 'confirmationSection') {
            tab.classList.add('hidden');
        }
    });
}
    async function getPixKey() {
        try {
            const response = await fetch(`/pix/keys/${userId}`);
            const keys = await response.json();
            if (keys && keys.length > 0) {
                return keys[0].pix_key; // Retorna a primeira chave Pix do usuário
            }
            return null; // Nenhuma chave encontrada
        } catch (error) {
            console.error('Erro ao obter chaves Pix:', error);
            return null;
        }
    }
    // Expose functions globally
    window.startQRCodeScanner = startQRCodeScanner;
    window.generateQRCode = generateQRCode;
    window.scanQRCode = scanQRCode;
});

window.stopQRCodeScanner = stopQRCodeScanner;
