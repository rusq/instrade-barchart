#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request as request
from urllib import parse
import http.cookiejar
import json
import gzip
import browser

URL = "https://www.barchart.com/stocks/quotes/{symbol}/insider-trades?page=1"
API_URL_INSIDER = 'https://www.barchart.com/proxies/core-api/v1/insiderTrades/get?fields=symbol%2CsymbolName%2CfullName%2CshortJobTitle%2CtransactionType%2CtransactionDate%2Camount%2CreportedPrice%2CusdValue%2CeodHolding%2CeodHoldingPercentage%2CsymbolCode%2ChasOptions%2CsymbolType%2ClastPrice%2CdailyLastPrice&orderBy=transactionDate&orderDir=desc&eq(symbol%2C{symbol})=&notIn(shortJobTitle%2C(US%20Congressman%2CUS%20Senator))=&meta=field.shortName%2Cfield.type%2Cfield.description&limit={limit}&raw=1&page={page}'


class Scraper:

    def __init__(self, symbol: str):
        self.symbol = symbol
        self.jar = http.cookiejar.CookieJar()
        opener = request.build_opener(request.HTTPCookieProcessor(self.jar))
        opener.addheaders = [
            ('User-Agent', browser.user_agent()),
            ('Connection', 'keep-alive'),
            ('Credentials', 'include'),
            ('Accept', 'application/json'),
            ('Host', 'www.barchart.com'),
            ('Accept-Encoding', 'gzip'),
        ]
        request.install_opener(opener)
        req = request.Request(URL.format(symbol=symbol))
        resp = request.urlopen(req)

        self.jar.make_cookies(resp, req)
        for cookie in self.jar:
            if cookie.name == 'XSRF-TOKEN':
                self.tok = parse.unquote(cookie.value)
                break

    def get_insider_trades(self):
        hdrs = {
            'User-Agent': browser.user_agent(),
            'X-XSRF-TOKEN': self.tok,
            'Referrer': URL.format(symbol=self.symbol),
        }

        page = 1
        page_sz = 100
        while True:
            req = request.Request(API_URL_INSIDER.format(
                symbol=self.symbol, limit=page_sz, page=page), headers=hdrs)
            resp = request.urlopen(req)
            encoding = resp.info().get('Content-Encoding')
            if encoding == 'gzip':
                j = json.loads(gzip.decompress(resp.read()).decode('utf-8'))
            else:
                j = json.loads(resp.read().decode('utf-8'))
            if not j['data']:
                break
            for v in j['data']:
                yield v.get('raw',{})
            if j['count'] < page_sz:
                break
            page += 1


if __name__ == '__main__':
    s = Scraper('MSFT')
    for i in s.get_insider_trades():
        print(json.dumps(i))
