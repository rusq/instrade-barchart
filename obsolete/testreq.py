#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import requests
from urllib import parse

import browser

URL = "https://www.barchart.com/stocks/quotes/MSFT/insider-trades?page=1"
API_URL = 'https://www.barchart.com/proxies/core-api/v1/insiderTrades/get?fields=symbol%2CsymbolName%2CfullName%2CshortJobTitle%2CtransactionType%2CtransactionDate%2Camount%2CreportedPrice%2CusdValue%2CeodHolding%2CeodHoldingPercentage%2CsymbolCode%2ChasOptions%2CsymbolType%2ClastPrice%2CdailyLastPrice&orderBy=transactionDate&orderDir=desc&eq(symbol%2CMSFT)=&notIn(shortJobTitle%2C(US%20Congressman%2CUS%20Senator))=&meta=field.shortName%2Cfield.type%2Cfield.description&limit=100&raw=1&page=1'

def main():
    sess = requests.Session()
    sess.headers = {
        'User-Agent': browser.user_agent(),
        'Credentials': 'include',
        'Accept': 'application/json',
        'Host': 'www.barchart.com',
        'Accept-Encoding': 'gzip, deflate, br',
    }
    sess.get(URL)
    tok = sess.cookies.get_dict().get('XSRF-TOKEN')
    print(tok)
    utok1 = parse.unquote(tok)
    print(utok1)
    sess.headers['X-XSRF-TOKEN'] = utok1
    sess.headers['Referrer'] = URL
    resp = sess.get(API_URL)
    print(resp.text)

if __name__ == '__main__':
    main()
