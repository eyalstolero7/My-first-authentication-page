var errMsg = document.querySelector(".invalid-data");
var inputText = document.querySelectorAll("input");

inputText.forEach((input) => {
    input.addEventListener("focusin", function(event) {
        errMsg.textContent = "";
    });
});