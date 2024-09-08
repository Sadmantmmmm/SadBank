// login.js
 async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            userId = data.user_id;
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('bankInterface').classList.remove('hidden');
            document.getElementById('Menuinferior').classList.add('slide-up');
            document.getElementById('Menuinferior').classList.remove('hidden');
            document.getElementById('userGreeting').textContent = username;
            document.getElementById('userid').textContent = data.user_id;
            document.getElementById('userInitial').textContent = username.charAt(0).toUpperCase();
            updateBalance();
            startAutoUpdate();
            requestNotificationPermission();
            startNotificationsFetch();
            getUserInfo();
            fetchTransactionHistory(userId);
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erro durante o login:', error);
        alert('Erro durante o login: ' + error.message);
    }
}
window.login = login;
