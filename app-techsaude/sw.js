/* TechSaúde — service worker mínimo, só para notificações.
   Necessário porque, no Android, o Chrome só mostra notificação por meio de um service worker.
   Não guarda nenhuma tela em cache (assim o app sempre carrega a versão mais nova). */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(event){ event.waitUntil(self.clients.claim()); });

// Ao tocar na notificação: volta para o app (ou abre a tela inicial).
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var destino = (event.notification.tag || '').indexOf('consulta') === 0 ? 'lembretedeconsultas.html' : 'medicamentos.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(lista){
      for(var i = 0; i < lista.length; i++){
        if('focus' in lista[i]) return lista[i].focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(destino) : null;
    })
  );
});
