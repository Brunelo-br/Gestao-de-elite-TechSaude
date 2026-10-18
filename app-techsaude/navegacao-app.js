(function(){
  'use strict';

  window.voltarTelaApp = function(){
    if(window.history.length > 1){
      window.history.back();
      return;
    }
    window.location.href = 'home.html';
  };
})();
