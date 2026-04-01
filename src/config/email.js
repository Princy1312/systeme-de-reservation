const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'notahiana.princy@gmail.com',
    pass: 'lqws sbyg cbyc ttfx'
  }
});

const sendVerificationCode = async (email, code) => {
  try {
    const mailOptions = {
      from: 'notahiana.princy@gmail.com',
      to: email,
      subject: 'Code de vérification - RÉSERV',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">RÉSERV</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Système de Réservation</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-bottom: 20px;">Code de vérification</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Vous avez demandé à vous connecter à votre compte RÉSERV. 
              Veuillez utiliser le code ci-dessous pour vérifier votre identité :
            </p>
            
            <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: monospace;">${code}</span>
            </div>
            
            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 20px;">
              Ce code expirera dans 10 minutes.<br>
              Ne partagez jamais ce code avec personne.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email.
              </p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationCode
};
