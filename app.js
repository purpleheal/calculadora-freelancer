// CACHE BUSTER
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    let unregisterPromises = [];
    for(let registration of registrations) {
      unregisterPromises.push(registration.unregister());
    }
    Promise.all(unregisterPromises).then(() => {
      // Once unregistered, force a hard reload from server
      if (!sessionStorage.getItem('cacheBusted')) {
        sessionStorage.setItem('cacheBusted', 'true');
        window.location.reload(true);
      }
    });
  });
} else {
  if (!sessionStorage.getItem('cacheBusted')) {
    sessionStorage.setItem('cacheBusted', 'true');
    window.location.reload(true);
  }
}
