
import "cordova-powerauth-mobile-sdk"
import { WDOActivationService} from "cordova-digital-onboarding"
import { WPNNetworking } from "cordova-powerauth-networking"

document.addEventListener('deviceready', onDeviceReady, false)

declare var  cordova: any;

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready')?.classList.add('ready');

    console.log(`${WPNNetworking.name}`)
    console.log(`${PowerAuth.name}`)
    console.log(`${WDOActivationService.name}`)
}
