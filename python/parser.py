"""
VBA Extraction using oletools.
Parsed modules are returned as dicts: { name, code, type }
"""

from oletools.olevba import VBA_Parser
from typing import List, Dict

def extract_vba_modules(file_path: str) -> List[Dict]:
    """
    Extracts all VBA module code from an .xlsm/.xls file.
    Returns a list of { name, code, type } dicts.
    """
    vba_parser = VBA_Parser(file_path)
    modules = []

    if vba_parser.detect_vba_macros():
        for (filename, stream_path, vba_filename, vba_code) in vba_parser.extract_macros():
            modules.append({
                "name": vba_filename or stream_path,
                "code": vba_code,
                "type": "module",
                "sourceFile": filename,
            })

    vba_parser.close()
    return modules
