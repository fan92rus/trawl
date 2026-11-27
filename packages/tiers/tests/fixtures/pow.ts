export const ALTCHA_WIDGET_HTML = `<!DOCTYPE html>
<html><body>
  <form id="login-form">
    <input type="text" name="username">
    <altcha-widget challenge="/api/altcha/challenge">
      <input type="hidden" name="altcha" value="">
    </altcha-widget>
    <button type="submit">Submit</button>
  </form>
</body></html>`

export const FRIENDLY_CAPTCHA_WIDGET_HTML = `<!DOCTYPE html>
<html><body>
  <form id="contact-form">
    <input type="email" name="email">
    <div class="frc-captcha" data-sitekey="FCMTEST123456">
      <button type="button" class="frc-button">Start verification</button>
      <input type="hidden" name="frc-captcha-solution" value=".UNACTIVATED">
    </div>
    <button type="submit">Send</button>
  </form>
</body></html>`

export const FRIENDLY_CAPTCHA_V2_HTML = `<!DOCTYPE html>
<html><body>
  <form>
    <div class="frc-captcha" data-sitekey="FCMTEST123456"></div>
    <input type="hidden" name="frc-captcha-response" value=".UNINITIALIZED">
  </form>
</body></html>`
