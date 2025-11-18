document.addEventListener('DOMContentLoaded', function() {
    
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault(); 
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        loginButton.disabled = true;
        loginButton.textContent = 'Verifying...';
        errorMessage.style.display = 'none';
        
        // Validate Mody University email format
        const emailRegex = /^[a-zA-Z0-9]+\.[a-zA-Z0-9]+@modyuniversity\.ac\.in$/i;
        if (!emailRegex.test(email)) {
            showError('Invalid email. Must be: name.department@modyuniversity.ac.in');
            return;
        }

        try {
            // Fetch the user data JSON
            const response = await fetch('users_40.json');
            
            if (!response.ok) {
                throw new Error('Could not load user data. File not found.');
            }
            
            const users = await response.json();
            
            // Find user in JSON
            const matchingUser = users.find(user => 
                user.email.toLowerCase() === email.toLowerCase() && 
                user.password === password
            );

            if (matchingUser) {
                console.log('Login successful for:', matchingUser.email);
                
                // Store session data
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('userEmail', matchingUser.email);
                
                // Redirect to main map page
                window.location.href = 'index.html'; 
            } else {
                showError('Invalid email or password.');
            }

        } catch (error) {
            console.error('Login Error:', error);
            showError('Login service is unavailable. Please try again later.');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});