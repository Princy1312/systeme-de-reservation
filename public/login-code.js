// Gestion de la saisie du code à 6 chiffres
document.addEventListener('DOMContentLoaded', function() {
    const emailForm = document.getElementById('email-form');
    const codeForm = document.getElementById('code-form');
    const emailInput = document.getElementById('email-input');
    const codeInputs = document.querySelectorAll('.code-input');
    const emailError = document.getElementById('email-error');
    const codeError = document.getElementById('code-error');
    const resendBtn = document.getElementById('resend-btn');
    const backBtn = document.getElementById('back-btn');
    const timer = document.getElementById('timer');
    const userEmailDisplay = document.getElementById('user-email');
    
    let userEmail = localStorage.getItem('pendingEmail') || '';
    let countdown = 60;
    let timerInterval;
    
    // Si un email est déjà enregistré, afficher directement le formulaire de code
    if (userEmail) {
        showCodeForm(userEmail);
    }
    
    // Gérer la soumission du formulaire email
    emailForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        
        if (!email) {
            showEmailError('Veuillez entrer une adresse email');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/send-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('pendingEmail', email);
                showCodeForm(email);
                showToast('Code envoyé avec succès');
            } else {
                showEmailError(data.message || 'Erreur lors de l\'envoi du code');
            }
        } catch (error) {
            showEmailError('Erreur de connexion. Veuillez réessayer.');
        }
    });
    
    // Gérer la saisie automatique entre les champs
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', function(e) {
            const value = e.target.value;
            
            // N'accepter que les chiffres
            if (!/^\d$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            // Ajouter la classe filled
            e.target.classList.add('filled');
            
            // Passer au champ suivant
            if (value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
        });
        
        input.addEventListener('keydown', function(e) {
            // Gérer la touche Retour arrière
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                codeInputs[index - 1].focus();
                codeInputs[index - 1].value = '';
                codeInputs[index - 1].classList.remove('filled');
            }
        });
        
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text');
            const digits = pastedData.replace(/\D/g, '').slice(0, 6);
            
            digits.split('').forEach((digit, i) => {
                if (i < codeInputs.length) {
                    codeInputs[i].value = digit;
                    codeInputs[i].classList.add('filled');
                }
            });
            
            // Focus sur le dernier champ rempli ou le prochain vide
            const nextEmpty = Array.from(codeInputs).findIndex(input => !input.value);
            if (nextEmpty !== -1) {
                codeInputs[nextEmpty].focus();
            } else {
                codeInputs[codeInputs.length - 1].focus();
            }
        });
    });
    
    // Soumission du formulaire de code
    codeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const code = Array.from(codeInputs).map(input => input.value).join('');
        
        if (code.length !== 6) {
            showCodeError('Veuillez entrer les 6 chiffres du code');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/verify-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userEmail,
                    code: code
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Stocker le token et rediriger vers l'application
                localStorage.setItem('token', data.token);
                localStorage.removeItem('pendingEmail');
                window.location.href = '/';
            } else {
                showCodeError(data.message || 'Code invalide');
                clearCodeInputs();
            }
        } catch (error) {
            showCodeError('Erreur de connexion. Veuillez réessayer.');
            clearCodeInputs();
        }
    });
    
    // Renvoyer le code
    resendBtn.addEventListener('click', async function() {
        if (resendBtn.disabled) return;
        
        try {
            resendBtn.disabled = true;
            resendBtn.textContent = 'Envoi en cours...';
            
            const response = await fetch('/api/auth/send-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userEmail
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Un nouveau code a été envoyé à votre email');
                startCountdown();
                clearCodeInputs();
                codeInputs[0].focus();
            } else {
                showCodeError(data.message || 'Erreur lors de l\'envoi du code');
            }
        } catch (error) {
            showCodeError('Erreur de connexion. Veuillez réessayer.');
        } finally {
            resendBtn.disabled = false;
            resendBtn.textContent = 'Renvoyer le code';
        }
    });
    
    // Retour au formulaire email
    backBtn.addEventListener('click', function() {
        showEmailForm();
    });
    
    // Fonctions utilitaires
    function showEmailForm() {
        emailForm.classList.remove('hidden');
        codeForm.classList.add('hidden');
        clearInterval(timerInterval);
        emailInput.focus();
    }
    
    function showCodeForm(email) {
        userEmail = email;
        userEmailDisplay.textContent = email;
        emailForm.classList.add('hidden');
        codeForm.classList.remove('hidden');
        codeInputs[0].focus();
        startCountdown();
    }
    
    function showEmailError(message) {
        emailError.textContent = message;
        emailError.classList.remove('hidden');
        setTimeout(() => {
            emailError.classList.add('hidden');
        }, 5000);
    }
    
    function showCodeError(message) {
        codeError.textContent = message;
        codeError.classList.remove('hidden');
        setTimeout(() => {
            codeError.classList.add('hidden');
        }, 5000);
    }
    
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hidden');
        }, 3000);
    }
    
    function clearCodeInputs() {
        codeInputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled');
        });
    }
    
    function startCountdown() {
        countdown = 60;
        resendBtn.disabled = true;
        
        timerInterval = setInterval(() => {
            countdown--;
            timer.textContent = `Vous pourrez renvoyer un code dans ${countdown}s`;
            
            if (countdown <= 0) {
                clearInterval(timerInterval);
                timer.textContent = '';
                resendBtn.disabled = false;
            }
        }, 1000);
    }
});
