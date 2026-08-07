(() => {
  'use strict';

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  const form = document.getElementById('messageForm');
  const nameInput = document.getElementById('msgName');
  const textInput = document.getElementById('msgText');
  const honeypot = document.getElementById('msgWebsite');
  const submitBtn = document.getElementById('msgSubmit');
  const statusEl = document.getElementById('msgStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot: real visitors never fill this hidden field. If it's filled,
    // silently pretend it worked so the bot doesn't learn to skip this field.
    if (honeypot.value.trim() !== '') {
      form.reset();
      statusEl.textContent = 'Sent — thanks!';
      statusEl.className = 'msg-status msg-status-ok';
      return;
    }

    const name = nameInput.value.trim();
    const message = textInput.value.trim();
    if (!name || !message) return;

    submitBtn.disabled = true;
    statusEl.textContent = 'Sending…';
    statusEl.className = 'msg-status';

    try {
      await db.collection('messages').add({
        name,
        message,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      form.reset();
      statusEl.textContent = 'Sent — thanks!';
      statusEl.className = 'msg-status msg-status-ok';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Something went wrong — try again.';
      statusEl.className = 'msg-status msg-status-err';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
