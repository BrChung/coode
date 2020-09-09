// Config

const apiUrl = "https://judge0.p.rapidapi.com";
const apiHost = "judge0.p.rapidapi.com";
const apiKey = "bb8f693609mshaf476b8c4e445a9p1482c1jsn8d28a3167617";
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
          title: "main.asm",
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
                {
                  type: "component",
                  componentName: "driver",
                  title: "driver.c",
                  isClosable: false,
                  componentState: {
                    readOnly: false,
                  },
                },
                {
                  type: "component",
                  componentName: "runner",
                  title: "run.sh",
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
  } catch (error) {
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
      window.exID = snapshot.val()["settings"]["exampleID"];
      window.layout.registerComponent("source", function (container, state) {
        window.editor = CodeMirror(container.getElement()[0], {
          lineNumbers: true,
          mode: "nasm",
          theme: "material-darker",
          readOnly: state.readOnly,
        });
        window.firepad = Firepad.fromCodeMirror(firepadRef, window.editor, {
          defaultText: examples[exID]["source"],
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

      window.layout.registerComponent("driver", function (container, state) {
        window.driverEditor = monaco.editor.create(container.getElement()[0], {
          automaticLayout: true,
          theme: "vs-dark",
          scrollBeyondLastLine: false,
          readOnly: state.readOnly,
          language: "c",
          value: examples[exID]["driver"],
          minimap: {
            enabled: false,
          },
        });
      });

      window.layout.registerComponent("runner", function (container, state) {
        window.runnerEditor = monaco.editor.create(container.getElement()[0], {
          automaticLayout: true,
          theme: "vs-dark",
          scrollBeyondLastLine: false,
          readOnly: state.readOnly,
          language: "shell",
          value: examples[exID]["compile"],
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
      langugageTitle.innerHTML = examples[exID]["title"];
      languageLogo.setAttribute(
        "src",
        `languages/${examples[exID]["short"]}.png`
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

function downloadSource() {
  var sourceValue = window.firepad.getText();
  var runnerValue = window.runnerEditor.getValue();
  var driverValue = window.driverEditor.getValue();

  var zip = new JSZip();
  zip.file("main.asm", sourceValue);
  zip.file("driver.c", driverValue);
  zip.file("run.sh", runnerValue);
  zip.generateAsync({ type: "blob" }).then(function (content) {
    saveAs(content, "assembly.zip");
  });
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

  var sourceValue = window.firepad.getText();
  var stdinValue = window.stdinEditor.getValue();
  var driverValue = window.driverEditor.getValue();
  var runnerValue = window.runnerEditor.getValue();

  var zip = new JSZip();
  var runnerParts = runnerValue.split("./");
  zip.file("main.asm", sourceValue);
  zip.file("driver.c", driverValue);
  zip.file("run", "./" + runnerParts[1]);
  zip.file(
    "compile",
    runnerParts[0].replace("nasm", "/usr/local/nasm-2.14.02/bin/nasm")
  );
  zip.generateAsync({ type: "base64" }).then(function (content) {
    var data = {
      language_id: 89,
      additional_files: content,
      redirect_stderr_to_stdout: true,
      stdin: encode(stdinValue),
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
          "x-rapidapi-host": apiHost,
          "x-rapidapi-key": apiKey,
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
  });
}

function fetchSubmission(submission_token) {
  $.ajax({
    url: apiUrl + "/submissions/" + submission_token + "?base64_encoded=true",
    type: "GET",
    async: true,
    crossDomain: true,
    headers: {
      "x-rapidapi-host": apiHost,
      "x-rapidapi-key": apiKey,
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
      .ref("cpsc240/" + hash)
      .once("value")
      .then(async function (snapshot) {
        if (snapshot.exists()) {
          ref = firebase.database().ref("cpsc240").child(hash);
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
  var exID = document.getElementById("selected-example").value;
  $("#new-ide").modal("hide");
  ref = firebase.database().ref("cpsc240");
  ref = ref.push(); // generate unique location.
  ref.set({ settings: { exampleID: exID } });
  window.location = window.location + "#" + ref.key; // add it as a hash to the URL.
  init();
}

// Example Source Code

const genericDriver =
  '// Author name: Brian Chung\n// Program title: Example\n// Course number: CPSC 240\n// Assignment number: infinity\n\n#include <stdio.h>\n#include <stdint.h>\n\nlong int start(); //name in asm label (ex. global start)\n\nint main()\n{long int result_code = -999;\n result_code = start();\n printf("%s%ld\\n","The result code is ",result_code);\n return 0;\n}\n';

const genericCompile =
  '# Author name: Brian Chung\n# Program title: Example\n# Course number: CPSC 240\n# Assignment number: infinity\n\n# ********************************************\n\n\necho "Bash script has started"\n\nrm *.out    # Remove other helper files.\nrm *.o\nrm *.lis\n\necho "Assembling main.asm"\n\n    # Assemble x86 module.\nnasm -f elf64 -o main.o -l main.lis main.asm\n\necho "Compiling driver.c"\n\n    # Compile C module.\ngcc -c -Wall -m64 -no-pie -o driver.o driver.c -std=c11\n\necho "Linking the object files"\n\n    # Link object files.\ngcc -m64 -no-pie -o executable.out -std=c11 main.o driver.o\n\necho "Running the program"\n./executable.out\n\necho "The bash script file will terminate"';

const arithmeticCompile =
  'echo "The script file for Program Integer Arithmetic has begun"\n\necho "Assemble main.asm"\nnasm -f elf64 -o main.o -l main.lis main.asm\n\necho "Compile driver.c"\ngcc -c -Wall -m64 -no-pie -o driver.o driver.c -std=c11\n\necho "Link the object files"\ngcc -m64 -no-pie -o executable.out -std=c11 main.o driver.o\n\necho "Run the program Integer Arithmetic:"\n./executable.out\n\necho "The script file will terminate"';

const arithmeticDriver =
  '#include <stdio.h>\n#include <stdint.h>\n\nlong int start();\n\nint main()\n{long int result_code = -999;\n result_code = start();\n printf("%s%ld\\n","The result code is ",result_code);\n return 0;\n}//End of main\n';

const printf_example =
  'section .data\n    welcome db "Welcome!", 10, 0\n    intformat db "%d", 10, 0\n    stringformat db "%s", 0\n\nsection .text\n    extern printf\n    global start\n\nstart:\n\n    ; copy int 7 to reg r12\n    mov r12, 7\n\n    ; print a welcome message\n    mov rdi, stringformat\n    mov rsi, welcome\n    mov rax, 0\n    call printf\n\n    ; print an integer\n    mov rdi, intformat\n    mov rsi, r12\n    mov rax, 0\n    call printf\n\n    ; exit program with code 0\n    mov qword rax, 0\n    ret';

const arithmetic =
  '\
;*****************************************************************************************************************************\n\
;Program name: "Integer Arithmetic".  This program demonstrates how to input and output long integer data and how to per-   *\n\
;form a few simple operations on integers.  Copyright (C) 2019 Floyd Holliday                                               *\n\
;This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License  *\n\
;version 3 as published by the Free Software Foundation.                                                                    *\n\
;This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied         *\n\
;Warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.     *\n\
;A copy of the GNU General Public License v3 is available here:  <https://www.gnu.org/licenses/>.                           *\n\
;*****************************************************************************************************************************\n\
\n;=======1=========2=========3=========4=========5=========6=========7=========8=========9=========0=========1=========2=========3**\n\
;\n;Author information\n;  Author name: Floyd Holliday\n;  Author email: holliday@fullerton.edu\n;\n;Program information\n\
;  Program name: Integer Arithmetic\n;  Programming languages: One modules in C and one module in X86\n;  Date program began:     2012-Nov-01\n\
;  Date program completed: 2012-Nov-04\n;  Date comments upgraded: 2019-July-01 and 2020-Jan-22\n\
;  Files in this program: driver.c, main.asm, run.sh\n;  Status: Complete.  No errors found after extensive testing.\n\
;\n;References for this program\n;  Jorgensen, X86-64 Assembly Language Programming with Ubuntu, Version 1.1.40.\n\
;  Robert Plantz, X86 Assembly Programming.  [No longer available as a free download]\n;\n;Purpose\n\
;  Show how to perform arithmetic operations on two operands both of type long integer.\n;  Show how to handle overflow of multiplication.\n\
;\n;This file\n;   File name: arithmetic.asm\n;   Language: X86-64 with Intel syntax\n;   Max page width: 132 columns\n\
;   Assemble: nasm -f elf64 -l main.lis -o main.o main.asm\n\
;   Link: gcc -m64 -no-pie -o current.out driver.o main.o        ;Ref Jorgensen, page 226, "-no-pie"\n\
;   Optimal print specification: 132 columns width, 7 points, monospace, 8½x11 paper\n\n\n\n\n\n\n\
;%include "debug.inc"                             ;Not used in this program: this line may be safely deleted.\n\n\
;Declare the names of programs called from this X86 source file, but whose own source code is not in this file.\n\
extern printf                                     ;Reference: Jorgensen book 1.1.40, page48\nextern scanf\n\n;Declare constants if needed\n\
null equ 0                                        ;Reference: Jorgensen book 1.1.40, page 34.\nnewline equ 10\n\n\
global start                                 ;Make this program callable by other programs.\n\n\
segment .data                                     ;Initialized data are placed in this segment\n\n\
welcome db "Welcome to Integer Arithmetic", newline, null\npromptforinteger1 db "Enter the first signed integer: ", null\n\
outputformat1 db "You entered %ld = 0x%lx", 10, 0\nstringoutputformat db "%s", 0\nsignedintegerinputformat db "%ld", null\n\
promptforinteger2 db "Enter the second signed integer: ", 0\noutputformat2long db "The product is %ld = 0x%lx", 10, 0\n\
outputformat2short db "The product is 0x%lx", 10, 0\noutputformat3 db "The quotient is %ld = 0x%lx, and the remainder is %ld = 0x%lx", 10 , 0\n\
productformatlong db "The product requires more than 64 bits.  It\'s value is 0x%016lx%016lx", 10, 0\n\
productformatshort db "The product is %ld = 0x%016lx", 10, 0\nquotientformat db "The quotient is %ld = 0x%016lx", 10, 0\n\
remainderformat db "The remainder is %ld = 0x%016lx", 10, 0\nfarewell db "I hope you enjoyed using my program as much as I enjoyed making it.  Bye.", 10, 0\n\n\
segment .bss                                      ;Uninitialized data are declared in this segment\n\n;Empty segment: there are no un-initialized arrays.\n\n\
segment .text                                     ;Instructions are placed in this segment\n\
start:                                       ;Entry point for execution of this program.\n\n\
;Back up the general purpose registers for the sole purpose of protecting the data of the caller.\n\
push rbp                                                    ;Backup rbp\n\
mov  rbp,rsp                                                ;The base pointer now points to top of stack\n\
push rdi                                                    ;Backup rdi\npush rsi                                                    ;Backup rsi\n\
push rdx                                                    ;Backup rdx\npush rcx                                                    ;Backup rcx\n\
push r8                                                     ;Backup r8\npush r9                                                     ;Backup r9\n\
push r10                                                    ;Backup r10\npush r11                                                    ;Backup r11\n\
push r12                                                    ;Backup r12\npush r13                                                    ;Backup r13\n\
push r14                                                    ;Backup r14\npush r15                                                    ;Backup r15\n\
push rbx                                                    ;Backup rbx\npushf                                                       ;Backup rflags\n\n\
;There are 15 pushes above.  Make one more push of any value so that the number of pushes is an even number\n\
push qword -1                                               ;Now the number of pushes is even\n\
;Registers rax, rip, and rsp are usually not backed up.\n\n\
;Output the welcome message                       ;This is a group of instructions jointly performing one task.\nmov qword rdi, stringoutputformat\n\
mov qword rsi, welcome\nmov qword rax, 0\ncall printf\n\n;Prompt for the first integer\nmov qword rdi, stringoutputformat\n\
mov qword rsi, promptforinteger1                  ;Place the address of the prompt into rdi\nmov qword rax, 0\ncall printf\n\n;Input the first integer\n\
mov qword rdi, signedintegerinputformat\n\
push qword -1                                     ;Place an arbitrary value on the stack; -1 is ok, any quad value will work\n\
mov qword rsi, rsp                                ;Now rsi points to that dummy value on the stack\n\
mov qword rax, 0                                  ;No vector registers\n\
call scanf                                        ;Call the external function; the new value is placed into the location that rsi points to\n\
pop qword r14                                     ;First inputted integer is saved in r14\n\n;Output the value previously entered\nmov qword rdi, outputformat1\n\
mov rsi, r14\nmov qword rdx, r14                                ;Both rsi and rdx hold the inputted value as well as r14\nmov qword rax, 0\ncall printf\n\n\
;Output a prompt for the second integer\nmov qword rdi, stringoutputformat\nmov qword rsi, promptforinteger2\nmov qword rax, 0\ncall printf\n\n\
;Input the second integer\nmov qword rdi, signedintegerinputformat\npush qword 999                                    ;Place an arbitrary value on the stack\n\
mov qword rsi, rsp                                ;Now rsi points to the top of the stack\nmov qword rax, 0\n\
call scanf                                        ;The new value is placed on top of the stack\n\
pop r15                                           ;The second inputted value is in r15 for safekeeping\n\n;Output the value previously entered\n\
mov qword rdi, outputformat1                                   \nmov qword rsi, r15\n\
mov qword rdx, r15                                ;All 3 registers hold a copy of the inputted value: rsi, rdx, r15\nmov qword rax, 0\n\
call printf\n\n;Perform the signed multiplication of two integers: rdx:rax <-- rax * r15 where rax holds a copy of the first input\n\
;Multiplication is explained in the Jorgensen book, version 1.1.40, starting page 87 if the two operands are unsigned\n\
;integers, and starting on page 91 if both operands are signed integers.\n\
;Summary: this is what the Jorgensen book say to do to multiply two 64-bit integers using the single operand form of \n;multiplication: \n\
;1.  Copy the first operand into rax.\n;2.  Make sure rdx is available (does not now hold valuable data)\n\
;3.  Copy the second operand into another available register, say r15\n\
;4.  Use the instruction "imul r15" without quotes assuming that either operand may be a signed integer.\n\
;5.  The product will be in rax -- unless the product is so large it will not fit into the 64 bits provided by rax.  In this\n\
;    later case the product will span two registers rdx:rax.  We use this \'single operand\' technique below.\n\n\
mov qword rax, r14                                ;Copy the first factor (operand) to rax\n\
mov qword rdx, 0                                  ;rdx contains no data we wish to save.\n\
imul r15                                          ;Use the signed multiplication instruction \'imul\' followed by the second factor\n\n\
;Now the product r14*r15 is in the pair rdx:rax. If the product will fit entirely in 64 bits then it will be store completely \n\
;in rax and rdx is not needed.  Nevertheless, we save both registers in the following 2 instructions.\n\
mov qword r12, rdx                                ;High order bits are saved in r12\n\
mov qword r13, rax                                ;Low order bits are saved in r13\n\n\
;Several references were consulted.  All stated that in the case of imul the flags cf and of change in unison.  Specifically,\n\
;when the product overflows beyond 64 bits both cf and of are set to 1, otherwise they are unset to 0.  We use the of flag here.\n\
;The \'jo\' in the next instruction means continue processing if the of variable called flag is equal to 1.\n\
jo multiplicationoverflow                         ;if(of==true) then continue execution at the multiplicationoverflow marker.\n\n\
;Output the computed product where 64 or less bits are needed for storage.\nmov qword rdi, productformatshort\n\
mov qword rsi, r13                                ;The low order bits are placed in the second parameter\n\
mov qword rdx, r13                                ;The exact same bits are placed in the third parameter\n\
mov qword rax, 0                                  ;Zero in rax\ncall printf\n\
jmp divisionsection                               ;Continue execution at the divisionsection marker\n\nmultiplicationoverflow:\n\
;Output the computed product where more than 64 bits are needed for storage of the product.\nmov qword rdi, productformatlong\n\
mov qword rsi, r12                                ;The high order bits are placed in the second parameter\n\
mov qword rdx, r13                                ;The low order bits are placed in the third parameter\n\
mov qword rax, 0                                  ;Zero in rax indicates no vector parameters\ncall printf\n\n\
divisionsection:\n;Divide the first integer by the second integer\n\
;Division of integers is explained in the Jorgensen book, version 1.1.40, starting on page 90.  If operands, dividend\n\
;and divisor, are unsigned use the instruction div, otherwise use the instruction idiv.  We have signed integers here\n\
;and therefore we use the assembly instruction idiv.  First it is necessary to set up the dividend pair rdx:rax.  The\n\
;Jorgensen book shows this setup on page 100.  We do the same thing directly below.\n\
mov qword rax, r14                                ;The first integer is in rax\n\
cqo                                               ;Sign extend the first integer to rdx:rax. Ref Jorgensen, page 777\n\
idiv r15                                          ;Divide rdx:rax by r15\n\
mov r13, rdx                                      ;Save the remainder in r13 for later use\n\n\
;Show the quotient\nmov qword rdi, quotientformat\nmov qword rsi, rax                                ;Copy the quotient to rsi\n\
mov qword rdx, rax                                ;Copy the quotient to rdx\nmov qword rax, 0\ncall printf\n\n;Show the remainder\n\
mov qword rdi, remainderformat\nmov qword rsi, r13                                ;Copy the remainder to rsi\n\
mov qword rdx, r13                                ;Copy the remainder to rdx\nmov qword rax, 0\ncall printf\n\n\
;Output the farewell message\nmov qword rdi, stringoutputformat\n\
mov qword rsi, farewell                           ;The starting address of the string is placed into the second parameter.\n\
mov qword rax, 0\ncall printf\n\n;Restore the original values to the general registers before returning to the caller.\n\
pop rax                                                     ;Remove the extra -1 from the stack\n\
popf                                                        ;Restore rflags\npop rbx                                                     ;Restore rbx\n\
pop r15                                                     ;Restore r15\npop r14                                                     ;Restore r14\n\
pop r13                                                     ;Restore r13\npop r12                                                     ;Restore r12\n\
pop r11                                                     ;Restore r11\npop r10                                                     ;Restore r10\n\
pop r9                                                      ;Restore r9\npop r8                                                      ;Restore r8\n\
pop rcx                                                     ;Restore rcx\npop rdx                                                     ;Restore rdx\n\
pop rsi                                                     ;Restore rsi\npop rdi                                                     ;Restore rdi\n\
pop rbp                                                     ;Restore rbp\n\n\
mov qword rax, 0                                  ;Return value 0 indicates successful conclusion.\n\
ret                                               ;Pop the integer stack and jump to the address represented by the popped value.\n';

const goldenRatio =
  '; Program to calcuate the length of the next golden ratio side 1:1.618\n; We will approximate 1.1618 as 55/34\n; Example func(34) => 21, func(21) = 13\n\nsection .data\n    welcome db "This Golden Ratio function is brought to you by Brian!", 10, 0\n    inputPrompt db "Please enter the length of the current side: ", 0\n    returnString db "The integer part of the length will be returned to the main program. Please enjoy your fancy UI.", 10, 0\n    recievedNumberFormat db "The number %ld was received.", 10, 0\n    resultFormat1 db "The length of the next side based on the Golden Ratio is %ld ", 0\n    resultFormat2 db "and %ld/55 meters.", 10, 0\n    stringFormat db "%s", 0\n    intPrintFormat db "%d", 10, 0\n    longIntFormat db "%ld", 0\n\n; used declaring variables. uninitialized static data, both variables and constants\n; bss is a static memory section that contains buffers for data to be declared at runtime\nsection .bss\n    var1: resq 1\n\n\nsection .text\n    extern printf\n    extern scanf\n    global start\n\nstart:\n\n    ; setup and align the stack\n    push rbp\n\n    ; print a welcome message\n    mov rdi, stringFormat\n    mov rsi, welcome\n    mov rax, 0\n    call printf\n\n    ; print a input prompt \n    mov rdi, stringFormat\n    mov rsi, inputPrompt\n    xor rax, rax\n    call printf\n    \n    ; get input via scanf\n    mov rdi, longIntFormat\n    mov rsi, var1\n    mov rax, 0\n    call scanf\n    \n    ; print number for the sake of STDOUT (This block will be removed in submission)\n    mov rdi, intPrintFormat\n    mov rsi, [var1]\n    mov rax, 0\n    call printf\n    \n    ; print recieved number\n    mov rdi, recievedNumberFormat\n    mov rsi, [var1] ; move the actual value instead of a pointer\n    mov rax, 0\n    call printf\n    \n    ; multiply 34 to input\n    mov rax, [var1]\n    mov rcx, 34\n    mul rcx\n    mov r12, rax\n    \n    ; divide multiple by 55\n    mov rdx, 0\n    mov rax, r12 ; Dividend\n    mov rcx, 55  ; Divisor => Quotient in RAX, Remainder in RDX\n    idiv rcx\n    mov r12, rax\n    mov r13, rdx\n\n    ; print first half of result\n    mov rdi, resultFormat1\n    mov rsi, r12\n    mov rax, 0\n    call printf\n    \n    ; print second half of result\n    mov rdi, resultFormat2\n    mov rsi, r13\n    mov rax, 0\n    call printf\n    \n    ; print return string\n    mov rdi, returnString\n    mov rsi, stringFormat\n    mov rax, 0\n    call printf\n    \n    ; restore stack\n    pop rbp\n    \n    ; exit program with result as exit code\n    mov rax, r12\n    ret';

const examples = {
  1: {
    source: printf_example,
    filename: "main",
    fileext: ".asm",
    mode: "UNKNOWN",
    title: "printf() - Strings and Integers (NASM)",
    short: "nasm",
    compile: genericCompile,
    driver: genericDriver,
  },
  2: {
    source: arithmetic,
    filename: "main",
    fileext: ".asm",
    mode: "UNKNOWN",
    title: "Professor Holliday - Arithmetic (NASM)",
    short: "nasm",
    compile: arithmeticCompile,
    driver: arithmeticDriver,
  },
  3: {
    source: goldenRatio,
    filename: "main",
    fileext: ".asm",
    mode: "UNKNOWN",
    title: "SI Example - Golden Ratio (NASM)",
    short: "nasm",
    compile: arithmeticCompile,
    driver: arithmeticDriver,
  },
};
