// app.js
let userId = null;
let transactions = [];

document.addEventListener('DOMContentLoaded', () => {
    // Adiciona event listeners para todos os elementos com data-action
    document.querySelectorAll('[data-action]').forEach(element => {
        element.addEventListener('click', handleAction);
        document.querySelector('button[data-action="login"]').addEventListener('click', login);
    });
});

function handleAction(event) {
    const action = event.target.dataset.action;
    switch(action) {
        case 'login':
            login();
            break;
        case 'register':
            register();
            break;
        case 'invest':
            invest();
            break;
        case 'transfer':
            transfer();
            break;
        case 'simulateLoan':
            simulateLoan();
            break;
        case 'applyLoan':
            applyLoan();
            break;
        case 'pixRegister':
            pixRegister();
            break;
        case 'pixTransfer':
            pixTransfer();
            break;
        case 'calculateInterest':
            calculateInterest();
            break;
        default:
            console.log('Ação não reconhecida:', action);
    }
} //

function startAutoUpdate() {
setInterval(updateBalance, 5000); // Verifica a cada 5 segundos
setInterval(getUserInfo,5000);
setInterval(getPixKeys,5000);
setInterval(fetchTransactionHistory(userId),60000);
}

function startNotificationsFetch() {
    fetchNotifications(); // Fetch immediately
    setInterval(fetchNotifications, 30000); // Then fetch every 30 seconds
}

async function fetchNotifications() {
const response = await fetch(`/notifications/${userId}`);
const notifications = await response.json();
notifications.forEach(notification => {
showCustomNotification(notification.message, true);
});

// Marcar todas as notificações como lidas
if (notifications.length > 0) {
await fetch(`/mark-notifications-read/${userId}`, { method: 'POST' });
}
}
async function fetchTransactionHistory(userId) {
    try {
        const response = await fetch(`/history/${userId}`);
        if (!response.ok) {
            throw new Error("Erro ao buscar histórico de transações");
        }

        transactions = await response.json();
        displayTransactions(transactions);
    } catch (error) {
        console.error("Erro ao exibir histórico:", error);
    }
}
function displayTransactions(transactionsToDisplay) {
    const historyBody = document.getElementById("historyBody");
    historyBody.innerHTML = "";

    if (transactionsToDisplay.length === 0) {
        historyBody.innerHTML = '<p class="text-center py-4 text-gray-500">Nenhuma transação encontrada.</p>';
        return;
    }

    transactionsToDisplay.forEach((transaction) => {
        const card = document.createElement("div");
        card.className = "transaction-item";

        const isOutgoing = transaction.sender_id === userId;
        const iconClass = isOutgoing ? "fa-arrow-up text-red-500" : "fa-arrow-down text-green-500";
        const amountClass = isOutgoing ? "negative" : "positive";

        const transactionText = isOutgoing
            ? `Você enviou para ${transaction.receiver_name}`
            : `Você recebeu de ${transaction.sender_name}`;

        card.innerHTML = `
            <div class="transaction-icon bg-${isOutgoing ? 'red' : 'green'}-100">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="transaction-details">
                <div class="flex flex-col mb-1">
                    <span class="font-semibold transaction-text text-primary">${transactionText}</span>
                    <span class="transaction-amount ${amountClass} text-sm">R$ ${transaction.amount.toFixed(2)}</span>
                </div>
                <div class="transaction-date text-xs text-gray-500">${new Date(transaction.datetime).toLocaleString()}</div>
            </div>
        `;

        historyBody.appendChild(card);
    });
}

function filterTransactions() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filtered = transactions.filter(
        (transaction) =>
            transaction.sender_name.toLowerCase().includes(query) ||
            transaction.receiver_name.toLowerCase().includes(query) ||
            transaction.amount.toString().includes(query)
    );
    displayTransactions(filtered);
}
function getIconForTransaction(transaction) {
    return transaction.sender_id === userId
        ? '<i class="fa-solid fa-arrow-up-from-bracket text-red-500 text-xl"></i>'
        : '<i class="fa-solid fa-arrow-down text-green-500 text-xl"></i>';
}
function showTab(tabName) {
    // Adiciona uma classe para indicar que a animação está em andamento
    document.body.classList.add('animating');

    // Adiciona a classe de animação de slide-down à aba atualmente visível
    document.querySelectorAll('.tab-content:not(.hidden)').forEach(tab => {
        tab.classList.add('slide-down');
        
        // Aguarda a animação de slide-down terminar antes de ocultar a aba
        tab.addEventListener('animationend', () => {
            tab.classList.add('hidden');
            tab.classList.remove('slide-down');
        }, { once: true });
    });

    // Mostra a aba selecionada com a animação de slide-up
    setTimeout(() => {
        const selectedTab = document.getElementById(tabName);
        console.log(tabName);
        if (selectedTab) {
            selectedTab.classList.remove('hidden');
            selectedTab.classList.add('slide-up');
            
            // Ajusta o scroll para a aba
            if (tabName === 'historyTab') {
                // Scroll para o topo
                selectedTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                // Scroll centralizado
                selectedTab.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 500);
    // Remove a classe de animação em andamento após um tempo suficiente para a animação completar
    setTimeout(() => {
        document.body.classList.remove('animating');
    }, 500); // Tempo da animação (ajuste conforme necessário)
}
function initialize(userid) {
    // Adiciona o evento de clique ao botão "Ver Histórico"
    const historyButton = document.querySelector('button[onclick="showTab(\'historyTab\')"]');
    if (historyButton) {
        historyButton.addEventListener('click', () => showTab('historyTab'));
    }
}
async function updateBalance() {
    const response = await fetch(`/user/info/${userId}`);
    const data = await response.json();

    if (response.ok) {
        const balanceElement = document.getElementById('balance');
        const currentBalance = parseFloat(balanceElement.innerText);
        const newBalance = parseFloat(data.balance.toFixed(2));

        // Verifica se o valor aumentou ou diminuiu e aplica a animação correta
        if (newBalance > currentBalance) {
            balanceElement.classList.remove('fade-down');
            balanceElement.classList.add('fade-up');
        } else if (newBalance < currentBalance) {
            balanceElement.classList.remove('fade-up');
            balanceElement.classList.add('fade-down');
        }

        // Atualiza o valor do saldo
        balanceElement.innerText = newBalance.toFixed(2);

        // Remove a animação após ela ocorrer, para que possa ser reaplicada no futuro
        setTimeout(() => {
            balanceElement.classList.remove('fade-up', 'fade-down');
        }, 500);
    }
}
async function transfer() {
const receiverId = parseInt(document.getElementById('receiverId').value);
const amount = parseFloat(document.getElementById('transferAmount').value);

const response = await fetch('/transfer', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ sender_id: userId, receiver_id: receiverId, amount })
});
const data = await response.json();
if(Notification.permission !== 'granted'){
alert(data.message);
}
updateBalance();
showCustomNotification(data.message + ` no valor de: R$${amount}`); // Notificação personalizada
}
async function getUserInfo() {
const response = await fetch(`/user/info/${userId}`);
const data = await response.json();

if (response.ok) {
const userInfo = `
    <p>Nome de usuário: ${data.username}</p>
    <p>Saldo: R$ ${data.balance.toFixed(2)}</p>
    <p>ID DA CONTA: ${userId}</p>
`;
document.getElementById('userInfo').innerHTML = userInfo;
} else {
alert(data.message);
}
}
async function pixRegister() {
const pix_key = prompt("Digite a chave Pix:");
if (pix_key) {
const response = await fetch('/pix/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, pix_key })
});
const data = await response.json();
if(Notification.permission !== 'granted'){
alert(data.message);
}
showCustomNotification(data.message); // Notificação personalizada
}
}
function getPixKeys() {
fetch(`/pix/keys/${userId}`)
.then(response => response.json())
.then(keys => {
    const keysContainer = document.getElementById('pixKeys');
    keysContainer.innerHTML = keys.map(key => `<p>${key.pix_key}</p>`).join('');
});
}
async function pixTransfer() {
const pix_key = prompt("Digite a chave Pix do destinatário:");
const amount = parseFloat(prompt("Digite o valor a transferir:")); // parseFloat garante que o valor seja numérico
if (pix_key && amount) {
const response = await fetch('/pix/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, pix_key, amount })
});
const data = await response.json();
if(Notification.permission !== 'granted'){
alert(data.message);
}
showCustomNotification(data.message); // Notificação personalizada
}
}
async function calculateInterest() {
const principal = prompt("Digite o valor principal:");
const rate = prompt("Digite a taxa de juros anual (%):");
const time = prompt("Digite o tempo em anos:");
if (principal && rate && time) {
const response = await fetch('/calculate_interest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ principal, rate, time })
});
const data = await response.json();
alert(`Os juros calculados são: R$ ${data.interest}`);
}
}
// Função para cancelar o pagamento PIX
function cancelPixPayment() {
    document.getElementById('confirmationSection').classList.add('hidden');
    startQRCodeScanner(); // Reiniciar o scanner
}
