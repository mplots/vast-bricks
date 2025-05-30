const partialUrl = window.location.pathname + window.location.search + window.location.hash;
img=document.createElement('img')
img.src="https://queue.simpleanalyticscdn.com/noscript.gif?hostname=splash.vastbricks.com&path="+partialUrl
document.body.append(img)
