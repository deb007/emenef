'use strict';

const applicationServerPublicKey = 'BHKjDvvfdGMLqYdIxX5ReQdiDYv-5bZGCn33w4nMvGOzjesYF71glPy1CioaHXFrlfXa__DIVj0aDXJJB8srFyg';

let isSubscribed = false;
let swRegistration = null;

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
  
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
  
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

if ('serviceWorker' in navigator && 'PushManager' in window) {
    console.log('Service Worker and Push is supported');

    navigator.serviceWorker.register('sw.js')
    .then(function(swReg) {
        console.log('Service Worker is registered', swReg);

        swRegistration = swReg;
        initializeUI();
    })
    .catch(function(error) {
        console.error('Service Worker Error', error);
    });
    } else {
    console.warn('Push messaging is not supported');
}

function initializeUI() {  
    // Set the initial subscription value
    swRegistration.pushManager.getSubscription()
    .then(function(subscription) {
        isSubscribed = !(subscription === null);
        updateSubscriptionOnServer(subscription);

        if (isSubscribed) {
        console.log('User IS subscribed.');
        } else {
        console.log('User is NOT subscribed.');
        }

        updateBtn();
    });
}

function updateBtn() {
    if (Notification.permission === 'denied') {
        console.log('Push Messaging Blocked.');
        updateSubscriptionOnServer(null);
        return;
    }
    
    if (isSubscribed) {
        console.log('Disable Push Messaging');
    } else {
        console.log('Enable Push Messaging');
    }

}
  
function subscribeUser() {
    const applicationServerKey = urlB64ToUint8Array(applicationServerPublicKey);
    swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    })
    .then(function(subscription) {
      console.log('User is subscribed.');
  
      updateSubscriptionOnServer(subscription);
  
      isSubscribed = true;
  
      updateBtn();
    })
    .catch(function(err) {
      console.log('Failed to subscribe the user: ', err);
      updateBtn();
    });
}

function unsubscribeUser() {
    swRegistration.pushManager.getSubscription()
    .then(function(subscription) {
      if (subscription) {
        return subscription.unsubscribe();
      }
    })
    .catch(function(error) {
      console.log('Error unsubscribing', error);
    })
    .then(function() {
      updateSubscriptionOnServer(null);
  
      console.log('User is unsubscribed.');
      isSubscribed = false;
  
      updateBtn();
    });
}
  

function updateSubscriptionOnServer(subscription) {
    // TODO: Send subscription to application server
    console.log(subscription);
    var jsonSubscription = '';
    if(subscription) {
        jsonSubscription = JSON.stringify(subscription);
    }
    console.log(jsonSubscription);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/subscribe', true);
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.onload = function() {
        console.log(this.responseText);
    };
    xhr.send(jsonSubscription);
    
}