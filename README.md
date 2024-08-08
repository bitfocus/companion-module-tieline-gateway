# companion-module-tieline-gateway

See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE)

## The companion module for tieline gateways

During the Paris 2024 Olympics I was manning our control room in IBC. 
One of the tasks was keeping an eye on the tieline gateway that we used to send home commentary audio from the OBS commentary positions on the different venues, back to our MCR. 
To do this I had an analoge monitor connected to the headphone output, so I could monitor anything in the matrix in the gateway. 

## Development
You're very welcome to add any features you would like. 
I have developed by reverse engineering by using in inspector while accessing the configuration page of the tielie gateway. By seing the requests the browser is sending, I have replicated those. 
So it should be possible to reverse engineer any feature of the codec. 

Let me know if you have any specific features you're missing, the I'll try and work on it, though my time is limited.