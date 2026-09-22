#!/usr/bin/env python3
# -*- coding: utf-8 -*-

def user_agent(webkit_version: str = "537.36", chrome_version: str = "129.0.0.0", os: str = "Macintosh; Intel Mac OS X 10_15_7"):
    return f'Mozilla/5.0 ({os}) AppleWebKit/{webkit_version} (KHTML, like Gecko) Chrome/{chrome_version} Safari/{webkit_version}'
