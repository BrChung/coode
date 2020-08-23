// Config

const apiUrl = "https://judge0.p.rapidapi.com";
const timeout = 200;
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
  timeEnd = performance.now();
  console.log(
    "It took " + (timeEnd - timeStart) + " ms to get submission result."
  );

  var status = data.status;
  var stdout = decode(data.stdout);
  var stderr = decode(data.stderr);
  var compile_output = decode(data.compile_output);
  var sandbox_message = decode(data.message);
  var time = data.time === null ? "-" : data.time + "s";
  var memory = data.memory === null ? "-" : data.memory + "KB";

  $statusLine.html(`${status.description}, ${time}, ${memory}`);

  if (blinkStatusLine) {
    $statusLine.addClass("blink");
    setTimeout(function () {
      blinkStatusLine = false;
      localStorageSetItem("blink", "false");
      $statusLine.removeClass("blink");
    }, 3000);
  }

  stdoutEditor.setValue(stdout);
  stderrEditor.setValue(stderr);
  compileOutputEditor.setValue(compile_output);
  sandboxMessageEditor.setValue(sandbox_message);

  if (stdout !== "") {
    var dot = document.getElementById("stdout-dot");
    if (!dot.parentElement.classList.contains("lm_active")) {
      dot.hidden = false;
    }
  }
  if (stderr !== "") {
    var dot = document.getElementById("stderr-dot");
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
  layout.updateSize();
  // updateScreenElements();
  // showMessages();
});

async function init() {
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
      langID = snapshot.val()["settings"]["languageID"];
      console.log(languages[langID]["mode"]);
      layout.registerComponent("source", function (container, state) {
        window.editor = monaco.editor.create(container.getElement()[0], {
          automaticLayout: true,
          language: languages[langID]["mode"],
          theme: "vs-dark",
          scrollBeyondLastLine: false,
          readOnly: state.readOnly,
        });
        window.firepad = Firepad.fromMonaco(firepadRef, editor, {
          defaultText: languages[langID]["source"],
          userId: userId,
        });
      });

      layout.registerComponent("stdin", function (container, state) {
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

      layout.registerComponent("stdout", function (container, state) {
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
      });

      layout.init();
    });
  });
  //// Create FirepadUserList (with our desired userId).
  var firepadUserList = FirepadUserList.fromDiv(
    firepadRef.child("users"),
    document.getElementById("userlist"),
    userId
  );

  //// Initialize contents.
  //   firepad.on("ready", function () {
  //     if (firepad.isHistoryEmpty()) {
  //       firepad.setText("Check out the user list to the left!");
  //     }
  //   });
}

const getText = () => {
  console.log(window.firepad);
  console.log(window.firepad.getText());
};

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
    fileext: "js",
    mode: "javascript",
  },
  71: { source: pythonSource, filename: "main", fileext: "py", mode: "python" },
};
