(function () {
  var TOKEN_KEY = 'frozen-sick-gh-token';
  var bar = document.getElementById('wiki-edit-bar');
  if (!bar) return;

  var config = window.WIKI_EDIT_CONFIG;
  var sourcePath = window.WIKI_SOURCE_PATH;
  if (!config || !config.owner || !config.repo || !config.branch) return;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function handleHashToken() {
    var hash = window.location.hash;
    if (hash.indexOf('#token=') !== 0) return false;
    var token = hash.slice(7);
    if (token) {
      setToken(token);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    }
    return false;
  }

  if (handleHashToken()) {
    renderBar();
    return;
  }

  var token = getToken();
  if (!token && !sourcePath) return;
  if (!token) {
    renderLoginLink();
    return;
  }
  if (!sourcePath) return;
  renderBar();

  function renderLoginLink() {
    var returnTo = encodeURIComponent(window.location.pathname || '/');
    var a = document.createElement('a');
    a.href = '/api/auth/login?return_to=' + returnTo;
    a.className = 'wiki-edit-login';
    a.textContent = 'Login with GitHub to edit';
    bar.appendChild(a);
  }

  function renderBar() {
    bar.innerHTML = '';
    if (!sourcePath) return;
    if (!getToken()) {
      renderLoginLink();
      return;
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wiki-edit-btn';
    btn.textContent = 'Edit';
    btn.addEventListener('click', openEditor);
    bar.appendChild(btn);
  }

  function openEditor() {
    var path = sourcePath;
    var owner = config.owner;
    var repo = config.repo;
    var branch = config.branch;
    var token = getToken();
    var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path) + '?ref=' + encodeURIComponent(branch);

    fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
      },
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load file: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var content = data.content ? atob(data.content.replace(/\n/g, '')) : '';
        var sha = data.sha;
        showModal(content, sha, path);
      })
      .catch(function (err) {
        alert(err.message || 'Failed to load file');
      });
  }

  function showModal(initialContent, sha, path) {
    var overlay = document.createElement('div');
    overlay.className = 'wiki-edit-modal-overlay';
    var wrap = document.createElement('div');
    wrap.className = 'wiki-edit-modal';
    var title = document.createElement('div');
    title.className = 'wiki-edit-modal-title';
    title.textContent = 'Edit: ' + path;
    var textarea = document.createElement('textarea');
    textarea.className = 'wiki-edit-textarea';
    textarea.value = initialContent;
    textarea.rows = 20;
    var actions = document.createElement('div');
    actions.className = 'wiki-edit-actions';
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'wiki-edit-cancel';
    cancelBtn.textContent = 'Cancel';
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'wiki-edit-save';
    saveBtn.textContent = 'Save';
    var msg = document.createElement('div');
    msg.className = 'wiki-edit-msg';

    function close() {
      document.body.removeChild(overlay);
    }

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    saveBtn.addEventListener('click', function () {
      var content = textarea.value;
      var owner = config.owner;
      var repo = config.repo;
      var branch = config.branch;
      var token = getToken();
      var putUrl = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path);
      msg.textContent = 'Saving…';
      msg.className = 'wiki-edit-msg';

      fetch(putUrl, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Edit: ' + path,
          content: btoa(unescape(encodeURIComponent(content))),
          sha: sha,
          branch: branch,
        }),
      })
        .then(function (r) {
          if (r.status === 409) throw new Error('File was changed on GitHub. Reload and try again.');
          if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || 'Save failed'); });
          return r.json();
        })
        .then(function () {
          msg.textContent = 'Saved. Changes will appear after the next deploy.';
          msg.className = 'wiki-edit-msg wiki-edit-msg-ok';
          setTimeout(close, 2000);
        })
        .catch(function (err) {
          msg.textContent = err.message || 'Save failed';
          msg.className = 'wiki-edit-msg wiki-edit-msg-err';
        });
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    wrap.appendChild(title);
    wrap.appendChild(textarea);
    wrap.appendChild(actions);
    wrap.appendChild(msg);
    overlay.appendChild(wrap);
    document.body.appendChild(overlay);
    textarea.focus();
  }
})();
