// Solicita permissão para mostrar notificações
function requestNotificationPermission() {
    if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            console.log('Permissão para notificações concedida.');
        } else {
            console.log('Permissão para notificações negada.');
        }
    });
    }
    }
    // Função para criar uma notificação
    function showNotification(title, body) {
    if (Notification.permission === 'granted') {
    new Notification(title, {
        body: body,
        icon: 'https://uxwing.com/wp-content/themes/uxwing/download/communication-chat-call/bell-icon.png' // URL do ícone da notificação
    });
    }
    }
    function showCustomNotification(message, isTransient = false) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.innerText = message;
            notification.classList.add('show');
    
            setTimeout(() => {
                notification.classList.remove('show');
            }, 5000);
        } else {
            console.error('Elemento de notificação não encontrado');
        }
    }

    window.requestNotificationPermission = requestNotificationPermission;
    window.showNotification = showNotification;
    window.showCustomNotification = showCustomNotification;