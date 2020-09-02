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
  var status = data.status;
  var stdout = decode(data.stdout);
  var compile_output = decode(data.compile_output);
  var sandbox_message = decode(data.message);
  var timeS = data.time === null ? "-" : data.time + "s";
  var timeMS = data.time === null ? "-" : data.time * 1000 + " ms";
  var memoryKB = data.memory === null ? "-" : data.memory + " KB";
  var memoryMB =
    data.memory === null ? "-" : (data.memory / 1000).toFixed(3) + " MB";
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

  $("select.dropdown").dropdown();
  $(".ui.dropdown").dropdown();
  $(".ui.dropdown.site-links").dropdown({ action: "hide", on: "hover" });

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
    return;
  }

  // Create a random ID to use as our user ID (we must give this to firepad and FirepadUserList).
  var userId = Math.floor(Math.random() * 9999999999).toString();

  require(["vs/editor/editor.main"], function () {
    window.layout = new GoldenLayout(layoutConfig, $("#ide-content"));

    firepadRef.once("value").then(function (snapshot) {
      window.langID = snapshot.val()["settings"]["languageID"];
      window.layout.registerComponent("source", function (container, state) {
        window.editor = CodeMirror(container.getElement()[0], {
          lineNumbers: true,
          mode: languages[langID]["mode"],
          theme: "monokai",
          readOnly: state.readOnly,
        });
        window.firepad = Firepad.fromCodeMirror(firepadRef, window.editor, {
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

      var langugageTitle = document.createElement("H3");
      var languageLogo = document.createElement("IMG");
      langugageTitle.innerHTML = languages[langID]["title"];
      languageLogo.setAttribute(
        "src",
        `languages/${languages[langID]["short"]}.png`
      );
      languageLogo.setAttribute("id", "ide-language-icon");
      var languageContainer = document.getElementById("ide-language");
      languageContainer.appendChild(languageLogo);
      languageContainer.appendChild(langugageTitle);
    });
  });
  //// Create FirepadUserList (with our desired userId).
  var firepadUserList = FirepadUserList.fromDiv(
    firepadRef.child("users"),
    document.getElementById("userlist"),
    userId
  );
}

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
          console.log("page/hash not found - redirecting to home");
          location.replace("/");
        }
      });
  } else {
    $("#new-ide").modal("setting", "closable", false).modal("show");
  }
  return ref;
}

function createNewIDE() {
  var langID = document.getElementById("selected-language").value;
  $("#new-ide").modal("hide");
  ref = firebase.database().ref("documents");
  ref = ref.push(); // generate unique location.
  ref.set({ settings: { languageID: langID } });
  window.location = window.location + "#" + ref.key; // add it as a hash to the URL.
  init();
}

// Template Source Code - Hello World
const assemblySource =
  "\
section	.text\n\
    global _start\n\
\n\
_start:\n\
\n\
    xor	eax, eax\n\
    lea	edx, [rax+len]\n\
    mov	al, 1\n\
    mov	esi, msg\n\
    mov	edi, eax\n\
    syscall\n\
\n\
    xor	edi, edi\n\
    lea	eax, [rdi+60]\n\
    syscall\n\
\n\
section	.rodata\n\
\n\
msg	db 'hello, world', 0xa\n\
len	equ	$ - msg\n\
";

const cSource =
  '\
#include <stdio.h>\n\
\n\
int main(void) {\n\
    printf("hello, world\\n");\n\
    return 0;\n\
}\n\
';

const cppSource =
  '\
#include <iostream>\n\
\n\
int main() {\n\
    std::cout << "hello, world" << std::endl;\n\
    return 0;\n\
}\n\
';

const javaSource =
  '\
public class Main {\n\
    public static void main(String[] args) {\n\
        System.out.println("hello, world");\n\
    }\n\
}\n\
';

const javascriptSource = 'console.log("hello, world");';

const pythonSource = 'print("hello, world")';

const languages = {
  45: {
    source: assemblySource,
    filename: "main",
    fileext: ".asm",
    mode: "nasm",
    title: "Assembly (NASM 2.14.02)",
    short: "nasm",
  },
  50: {
    source: cSource,
    filename: "main",
    fileext: ".c",
    mode: "clike",
    title: "C (GCC 9.2.0)",
    short: "c",
  },
  54: {
    source: cppSource,
    filename: "main",
    fileext: ".cpp",
    mode: "clike",
    title: "C++ (GCC 9.2.0)",
    short: "cpp",
  },
  62: {
    source: javaSource,
    filename: "Main",
    fileext: ".java",
    mode: "clike",
    title: "Java (OpenJDK 13.0.1)",
    short: "java",
  },
  63: {
    source: javascriptSource,
    filename: "script",
    fileext: ".js",
    mode: "javascript",
    title: "JavaScript (Node.js 12.14.0)",
    short: "javascript",
  },
  70: {
    source: pythonSource,
    filename: "main",
    fileext: ".py",
    mode: "python",
    title: "Python (2.7.17)",
    short: "python",
  },
  71: {
    source: pythonSource,
    filename: "main",
    fileext: ".py",
    mode: "python",
    title: "Python (3.8.1)",
    short: "python",
  },
};
