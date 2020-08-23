// Config

const apiUrl = "https://judge0.p.rapidapi.com";
const check_timeout = 200;
const layoutConfig = {
  settings: {
    showPopoutIcon: false,
    reorderEnabled: true,
  },
  dimensions: {
    borderWidth: 3,
    headerHeight: 22,
  },
  content: [
    {
      type: "row",
      content: [
        {
          type: "component",
          componentName: "source",
          title: "SOURCE",
          isClosable: false,
          componentState: {
            readOnly: false,
          },
        },
        {
          type: "column",
          content: [
            {
              type: "stack",
              content: [
                {
                  type: "component",
                  componentName: "stdin",
                  title: "STDIN",
                  isClosable: false,
                  componentState: {
                    readOnly: false,
                  },
                },
              ],
            },
            {
              type: "stack",
              content: [
                {
                  type: "component",
                  componentName: "stdout",
                  title: "STDOUT",
                  isClosable: false,
                  componentState: {
                    readOnly: true,
                  },
                },
                {
                  type: "component",
                  componentName: "compile output",
                  title: "COMPILE OUTPUT",
                  isClosable: false,
                  componentState: {
                    readOnly: true,
                  },
                },
                {
                  type: "component",
                  componentName: "sandbox message",
                  title: "SANDBOX MESSAGE",
                  isClosable: false,
                  componentState: {
                    readOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// Utility

function encode(str) {
  return btoa(unescape(encodeURIComponent(str || "")));
}

function decode(bytes) {
  var escaped = escape(atob(bytes || ""));
  try {
    return decodeURIComponent(escaped);
  } catch {
    return unescape(escaped);
  }
}

function showError(title, content) {
  $("#site-modal #title").html(title);
  $("#site-modal .content").html(content);
  $("#site-modal").modal("show");
}

// Handlers

function handleError(jqXHR, textStatus, errorThrown) {
  showError(
    `${jqXHR.statusText} (${jqXHR.status})`,
    `<pre>${JSON.stringify(jqXHR, null, 4)}</pre>`
  );
}

function handleRunError(jqXHR, textStatus, errorThrown) {
  handleError(jqXHR, textStatus, errorThrown);
  $runBtn.removeClass("loading");
}

function handleResult(data) {
  console.log(data);
  timeEnd = performance.now();
  console.log(
    "It took " + (timeEnd - timeStart) + " ms to get submission result."
  );

  var status = data.status;
  var stdout = decode(data.stdout);
  var compile_output = decode(data.compile_output);
  var sandbox_message = decode(data.message);
  var timeS = data.time === null ? "-" : data.time + "s";
  var timeMS = data.time === null ? "-" : data.time * 1000 + " ms";
  var memoryKB = data.memory === null ? "-" : data.memory + " KB";
  var memoryMB =
    data.memory === null ? "-" : (data.memory / 1000).toFixed(3) + " MB";

  console.log(sandbox_message);
  sandbox_message += `${
    sandbox_message === "" ? "" : "\n"
  }Runtime: ${timeMS}\nMemory: ${memoryMB}`;

  $statusLine.html(`${status.description}, ${timeS}, ${memoryKB}`);

  window.stdoutEditor.setValue(stdout);
  window.compileOutputEditor.setValue(compile_output);
  window.sandboxMessageEditor.setValue(sandbox_message);

  if (stdout !== "") {
    var dot = document.getElementById("stdout-dot");
    if (!dot.parentElement.classList.contains("lm_active")) {
      dot.hidden = false;
    }
  }
  if (compile_output !== "") {
    var dot = document.getElementById("compile-output-dot");
    if (!dot.parentElement.classList.contains("lm_active")) {
      dot.hidden = false;
    }
  }
  if (sandbox_message !== "") {
    var dot = document.getElementById("sandbox-message-dot");
    if (!dot.parentElement.classList.contains("lm_active")) {
      dot.hidden = false;
    }
  }

  $runBtn.removeClass("loading");
}

// Ajax

$(window).resize(function () {
  window.layout.updateSize();
  // updateScreenElements();
  // showMessages();
});

async function init() {
  $runBtn = $("#run-btn");
  $runBtn.click(function (e) {
    run();
  });

  $statusLine = $("#status-line");

  $("body").keydown(function (e) {
    var keyCode = e.keyCode || e.which;
    if (keyCode == 120) {
      // F9
      e.preventDefault();
      run();
    }
  });

  //// Get Firebase Database reference.
  var firepadRef = await getExampleRef();

  if (firepadRef === null) {
    return console.log("error ref is null");
  }

  // Create a random ID to use as our user ID (we must give this to firepad and FirepadUserList).
  var userId = Math.floor(Math.random() * 9999999999).toString();

  require(["vs/editor/editor.main"], function () {
    window.layout = new GoldenLayout(layoutConfig, $("#ide-content"));

    firepadRef.once("value").then(function (snapshot) {
      window.langID = snapshot.val()["settings"]["languageID"];
      console.log(languages[langID]["mode"]);
      window.layout.registerComponent("source", function (container, state) {
        window.editor = monaco.editor.create(container.getElement()[0], {
          automaticLayout: true,
          language: languages[langID]["mode"],
          theme: "vs-dark",
          scrollBeyondLastLine: false,
          readOnly: state.readOnly,
        });
        window.firepad = Firepad.fromMonaco(firepadRef, window.editor, {
          defaultText: languages[langID]["source"],
          userId: userId,
        });
      });

      window.layout.registerComponent("stdin", function (container, state) {
        window.stdinEditor = monaco.editor.create(container.getElement()[0], {
          automaticLayout: true,
          theme: "vs-dark",
          scrollBeyondLastLine: false,
          readOnly: state.readOnly,
          language: "plaintext",
          minimap: {
            enabled: false,
          },
        });
      });

      window.layout.registerComponent("stdout", function (container, state) {
        window.stdoutEditor = monaco.editor.create(container.getElement()[0], {
          automaticLayout: true,
          theme: "vs-dark",
          scrollBeyondLastLine: false,
          readOnly: state.readOnly,
          language: "plaintext",
          minimap: {
            enabled: false,
          },
        });

        container.on("tab", function (tab) {
          tab.element.append(
            '<span id="stdout-dot" class="dot" hidden></span>'
          );
          tab.element.on("mousedown", function (e) {
            e.target.closest(".lm_tab").children[3].hidden = true;
          });
        });
      });

      window.layout.registerComponent("compile output", function (
        container,
        state
      ) {
        window.compileOutputEditor = monaco.editor.create(
          container.getElement()[0],
          {
            automaticLayout: true,
            theme: "vs-dark",
            scrollBeyondLastLine: false,
            readOnly: state.readOnly,
            language: "plaintext",
            minimap: {
              enabled: false,
            },
          }
        );

        container.on("tab", function (tab) {
          tab.element.append(
            '<span id="compile-output-dot" class="dot" hidden></span>'
          );
          tab.element.on("mousedown", function (e) {
            e.target.closest(".lm_tab").children[3].hidden = true;
          });
        });
      });

      window.layout.registerComponent("sandbox message", function (
        container,
        state
      ) {
        window.sandboxMessageEditor = monaco.editor.create(
          container.getElement()[0],
          {
            automaticLayout: true,
            theme: "vs-dark",
            scrollBeyondLastLine: false,
            readOnly: state.readOnly,
            language: "plaintext",
            minimap: {
              enabled: false,
            },
          }
        );

        container.on("tab", function (tab) {
          tab.element.append(
            '<span id="sandbox-message-dot" class="dot" hidden></span>'
          );
          tab.element.on("mousedown", function (e) {
            e.target.closest(".lm_tab").children[3].hidden = true;
          });
        });
      });

      window.layout.init();
    });
  });
  //// Create FirepadUserList (with our desired userId).
  var firepadUserList = FirepadUserList.fromDiv(
    firepadRef.child("users"),
    document.getElementById("userlist"),
    userId
  );
}

const getText = () => {
  console.log(window.firepad);
  console.log(window.firepad.getText());
};

function downloadSource(filename) {
  filename = filename === undefined ? languages[langID]["filename"] : filename;
  filename += languages[langID]["fileext"];
  download(window.firepad.getText(), filename, "text/plain");
}

function run() {
  if (window.firepad.getText().trim() === "") {
    showError("Error", "Source code can't be empty!");
    return;
  } else {
    $runBtn.addClass("loading");
  }

  document.getElementById("stdout-dot").hidden = true;
  document.getElementById("compile-output-dot").hidden = true;
  document.getElementById("sandbox-message-dot").hidden = true;

  window.stdoutEditor.setValue("");
  window.compileOutputEditor.setValue("");
  window.sandboxMessageEditor.setValue("");

  var sourceValue = encode(window.firepad.getText());
  var stdinValue = encode(window.stdinEditor.getValue());

  var data = {
    source_code: sourceValue,
    language_id: window.langID,
    stdin: stdinValue,
    redirect_stderr_to_stdout: true,
  };

  var sendRequest = function (data) {
    timeStart = performance.now();
    $.ajax({
      url: apiUrl + `/submissions?base64_encoded=true&wait=false`,
      type: "POST",
      async: true,
      crossdomain: true,
      contentType: "application/json",
      processData: false,
      headers: {
        "x-rapidapi-host": "judge0.p.rapidapi.com",
        "x-rapidapi-key": "bb8f693609mshaf476b8c4e445a9p1482c1jsn8d28a3167617",
        "content-type": "application/json",
        accept: "application/json",
      },
      data: JSON.stringify(data),
      success: function (data, textStatus, jqXHR) {
        console.log(`Your submission token is: ${data.token}`);
        setTimeout(fetchSubmission.bind(null, data.token), check_timeout);
      },
      error: handleRunError,
    });
  };

  sendRequest(data);
}

function fetchSubmission(submission_token) {
  $.ajax({
    url: apiUrl + "/submissions/" + submission_token + "?base64_encoded=true",
    type: "GET",
    async: true,
    crossDomain: true,
    headers: {
      "x-rapidapi-host": "judge0.p.rapidapi.com",
      "x-rapidapi-key": "bb8f693609mshaf476b8c4e445a9p1482c1jsn8d28a3167617",
    },
    success: function (data, textStatus, jqXHR) {
      if (data.status.id <= 2) {
        // In Queue or Processing
        setTimeout(fetchSubmission.bind(null, submission_token), check_timeout);
        return;
      }
      handleResult(data);
    },
    error: handleRunError,
  });
}

// Helper to get hash from end of URL or generate a random one.
async function getExampleRef() {
  console.log("i ran");
  var ref = null;
  var hash = window.location.hash.replace(/#/g, "");
  if (hash) {
    await firebase
      .database()
      .ref("documents/" + hash)
      .once("value")
      .then(async function (snapshot) {
        if (snapshot.exists()) {
          ref = firebase.database().ref("documents").child(hash);
        } else {
          console.log("no hash found");
        }
      });
  } else {
    console.log("new page");
    ref = firebase.database().ref("documents");
    ref = ref.push(); // generate unique location.
    var langIDTEMP = 63;
    ref.set({ settings: { languageID: langIDTEMP } });
    window.location = window.location + "#" + ref.key; // add it as a hash to the URL.
  }
  console.log(ref);
  return ref;
}

// Template Source Code - Hello World
const javascriptSource = 'console.log("hello, world");';

const pythonSource = 'print("hello, world")';

const languages = {
  63: {
    source: javascriptSource,
    filename: "script",
    fileext: ".js",
    mode: "javascript",
  },
  71: {
    source: pythonSource,
    filename: "main",
    fileext: ".py",
    mode: "python",
  },
};
