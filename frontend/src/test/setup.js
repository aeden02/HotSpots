// jsdom is a fake browser used in tests and doesnt support <dialog> modals yet. 
//these are stand-ins. 

if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
        this.open = true; 
    }
    HTMLDialogElement.prototype.close = function() {
        this.open = false; 
    }

}