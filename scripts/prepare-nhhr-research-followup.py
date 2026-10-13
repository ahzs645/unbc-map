#!/usr/bin/env python3
"""Release institutional historical NSERC and bounded publisher research context.

Use --input with retained DATA-Cxxx original folders; --refresh follows the
actual authorized manifest/dataset/catalogue/original IDs and validates hashes.
The EXTERNAL-NSERC-2011 folder holds separately pinned public publisher files;
refresh also retrieves these exact official URLs without Zoer credentials.
--check verifies byte-identical source/public snapshots, provenance and review.
No applicant, co-applicant, director, contact or participant rows are emitted.
"""
import argparse,collections,csv,hashlib,io,json,pathlib,re,urllib.request
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
ROOT=pathlib.Path(__file__).resolve().parents[1]
HOST='https://zoer.k8s.overtheedgepaper.ca'
MANIFEST=HOST+'/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
CATALOGUE='3f55330b-895e-4153-afc8-467ec545a1e7'
SOURCES=[{'collectionId': 'DATA-C017',
  'datasetId': '6eb40441-1a52-4331-8512-66e09ee2c11d',
  'filename': 'cra_t3010_2023_charity_finance_compact.csv',
  'sha256': '0096d4587b59fc57ea5e033e9d66b551d95fde6a46cd4bf9afd88a180093be4a',
  'originalFileIds': ['8abaf5e2-cab0-4216-b671-a6e9aaed7a53'],
  'sourceRelativePath': 'Data '
                        'Research/Data/processed/report_extracts/finance_rankings/cra_t3010_2023_charity_finance_compact.csv',
  'tables': [{'tableName': 'nhhr_data_c017_efb036e5cd0b_zip_data_c017_cra_t3',
              'rows': 83969,
              'parquetSha256': '7030fa54655c9d30ff6f3244aab89a086de21dd95a04e801b09f62821d52aa1d',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C017',
  'datasetId': '6eb40441-1a52-4331-8512-66e09ee2c11d',
  'filename': 'cra_t3010_2023_finance_field_inventory.csv',
  'sha256': '325394140c376340f4525df520e14aa886aea0b20f250eec53fd9feeef9ee13d',
  'originalFileIds': ['320689d3-2d2b-458f-a702-8942b60241dd'],
  'sourceRelativePath': 'Data '
                        'Research/Data/processed/report_extracts/finance_rankings/cra_t3010_2023_finance_field_inventory.csv',
  'tables': [{'tableName': 'nhhr_data_c017_efb036e5cd0b_zip_data_c017__5',
              'rows': 155,
              'parquetSha256': '9bd206f55b2a5535e7b4d2291a9859860d818bfb0352bf7d3d7db5eb34241ca9',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C017',
  'datasetId': '6eb40441-1a52-4331-8512-66e09ee2c11d',
  'filename': 'research_infosource_2025_rankings_normalized.csv',
  'sha256': '9cf7adfbf8e91ce04f97cef368b9558a97de6a6c0562de2018351148f0a7c95e',
  'originalFileIds': ['9d433849-621d-4ab2-9583-8abc46e8e28a'],
  'sourceRelativePath': 'Data '
                        'Research/Data/processed/report_extracts/finance_rankings/research_infosource_2025_rankings_normalized.csv',
  'tables': [{'tableName': 'nhhr_data_c017_efb036e5cd0b_zip_data_c017_resear',
              'rows': 90,
              'parquetSha256': '5da8abadc7b4b06eefb60c3de02ab894b6fc17afaad8c7d574a2095f383769d5',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C043',
  'datasetId': 'b839ab83-e3a5-4f73-8b4c-84ac1de47829',
  'filename': 'cra_t3010_2023_financial_d_and_schedule_6_updated.csv',
  'sha256': '2080c6479f0c1b060e23c4aafc95a5beac65943460b0644479558be947ed96e2',
  'originalFileIds': ['40ff07b0-a7be-4325-996b-81f9c88926a5'],
  'sourceRelativePath': 'Data '
                        'Research/Data/raw/cra_t3010/cra_t3010_2023_financial_d_and_schedule_6_updated.csv',
  'tables': [{'tableName': 'nhhr_data_c043_7644c105ae61_zip_data_c043__4',
              'rows': 83812,
              'parquetSha256': '9fac2445faa35cadcfac6e61a799479f8c4e4a214400fbac2d62edf980ed0320',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C043',
  'datasetId': 'b839ab83-e3a5-4f73-8b4c-84ac1de47829',
  'filename': 'cra_t3010_2023_financial_section_a_b_c.csv',
  'sha256': 'aebc4c2105d4c651eb9c95431451fe225fee1b48da89bf474d4bd5014c43c81d',
  'originalFileIds': ['c9c28087-d710-4ac1-8360-89bd14609364'],
  'sourceRelativePath': 'Data Research/Data/raw/cra_t3010/cra_t3010_2023_financial_section_a_b_c.csv',
  'tables': [{'tableName': 'nhhr_data_c043_7644c105ae61_zip_data_c043__5',
              'rows': 84155,
              'parquetSha256': '2d5b20e76b553ee948099713bf26806400c257c88bcd366135aac1884e557fa4',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C043',
  'datasetId': 'b839ab83-e3a5-4f73-8b4c-84ac1de47829',
  'filename': 'cra_t3010_2023_ident_update.csv',
  'sha256': 'd67096e499eac2d483e42207183eb6ca358aceb1631a6bca6e23ca0e699783ac',
  'originalFileIds': ['85d42f22-4e69-4596-83cc-a5be6a0ce37c'],
  'sourceRelativePath': 'Data Research/Data/raw/cra_t3010/cra_t3010_2023_ident_update.csv',
  'tables': [{'tableName': 'nhhr_data_c043_7644c105ae61_zip_data_c043__6',
              'rows': 83969,
              'parquetSha256': '9ea92acdf505a02fceb9e03b4c872a8df59b332c096ccdb5aa0050abce2e59ec',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C045',
  'datasetId': '01ad6a0d-3db4-42a8-8501-7af1d597335d',
  'filename': 'research_infosource_2025_top_40_hospitals_browser.csv',
  'sha256': '51f31d1deb49a0743caad501d0c5b17b48542687ac01162be76a54976853bf97',
  'originalFileIds': ['463c0c2b-04ad-49e6-bb42-55ecaa9df140'],
  'sourceRelativePath': 'Data '
                        'Research/Data/raw/manual_reports/research_infosource_2025_top_40_hospitals_browser.csv',
  'tables': [{'tableName': 'nhhr_data_c045_c5236fe5c93f_zip_data_c045__35',
              'rows': 40,
              'parquetSha256': '6a5b63b37341efe447a17162dd5cb23816a96095e68346c2398b7395d6ac3c1d',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C045',
  'datasetId': '01ad6a0d-3db4-42a8-8501-7af1d597335d',
  'filename': 'research_infosource_2025_top_50_universities_browser.csv',
  'sha256': '7fca8ed5a823409b3d418f148cbc505abb22c2fe3991ce544ac8344b7870e951',
  'originalFileIds': ['e7ca9f2e-ac4e-4125-887c-aee2cc068215'],
  'sourceRelativePath': 'Data '
                        'Research/Data/raw/manual_reports/research_infosource_2025_top_50_universities_browser.csv',
  'tables': [{'tableName': 'nhhr_data_c045_c5236fe5c93f_zip_data_c045__36',
              'rows': 50,
              'parquetSha256': 'd8e85af2cac59bb62cb0fc1b7a0aa08f118cce32f19bea6092d8353af17ed3fc',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_000_Table_definition_-_Awards.csv',
  'sha256': 'd2bec5c48f546a144b89e0d7ea9a25e635d5fce86689bbc4ed24862da09fec22',
  'originalFileIds': ['4e8a0bbb-ce23-4bc5-940c-a5f25df865d6'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_000_Table_definition_-_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_000',
              'rows': 36,
              'parquetSha256': '598f6f01ffd5c88887a2bc805b48dfb053848cfce9cb736f3a0a2d9fcd9c579f',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_003_1991_Awards.csv',
  'sha256': '1dd15eea1336413335178621a71dca1ef95a4dc115cba22018e8818e186854c6',
  'originalFileIds': ['b5f117dc-6da2-4edf-9677-4f8e61b7df53'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_003_1991_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_003',
              'rows': 18458,
              'parquetSha256': 'ba5083c05a2abdef96d49e304ba6650c0dfe3e7748cd2d76180993aa9043bce8',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_006_1992_Awards.csv',
  'sha256': '32bc65fe61af856f5be0baa8d774d4ad39b9ddefeaef65a91bd9fdfd6148cf02',
  'originalFileIds': ['c158a744-7150-4a08-9a75-442e20a070ee'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_006_1992_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_006',
              'rows': 19154,
              'parquetSha256': '1601ca158dce83aba8af3f9d6b7f41c0baa737bd5c9d44c0d3b49b8f102c796a',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_011_1993_Awards.csv',
  'sha256': 'e4e197428976bd323de469ed57b357b01c961288a2f69a1c3861d5c846788bb1',
  'originalFileIds': ['7c53c961-ceb7-42b2-a920-b0eb1c0365f0'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_011_1993_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_011',
              'rows': 17993,
              'parquetSha256': '7c23f7c63447baacdbde6d9dadfa3aa31992a694e2370354a680ac877a71c00a',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_012_1994_Awards.csv',
  'sha256': '4eec3250fc027957bb3329a1d1ce0a1b6c54d214aeb0212a18305745498ba535',
  'originalFileIds': ['8deaf768-45fb-4328-8ac9-fe68cb2c6718'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_012_1994_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_012',
              'rows': 17400,
              'parquetSha256': '66b1389cbe11e56842eec5e0b669f0f0f6da1dcd619600cf56748d4eccd7814a',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_015_1995_Awards.csv',
  'sha256': 'df5dcad0d2d1b106ea4c1ae9980dc4417fc02432a789c7a0bf3db7b46bb896ee',
  'originalFileIds': ['8f4f0037-bfa3-423c-8f29-3a1a94858988'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_015_1995_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_015',
              'rows': 15862,
              'parquetSha256': '74e73c7444dc721fc58e72f6b10424f3f548985195e3e829c1236eb18d22473c',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_018_1996_Awards.csv',
  'sha256': '68889d405b0201dd360a9e8f68894c03e7cf1bcd0d42b90f9856f4c65c8ad90c',
  'originalFileIds': ['24f9aed0-c1e3-4150-a9f4-c023b3f9c3b4'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_018_1996_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_018',
              'rows': 14295,
              'parquetSha256': 'de213792a66c0a41eff140bff8da41a452f40dbae69fd54cecdd4ff9dd218275',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_021_1997_Awards.csv',
  'sha256': '31f5ac0f6316282f53520decce3db0aa16988557a497397f1374ce37e16a151a',
  'originalFileIds': ['79ab4df4-5612-42ea-878b-877c0e0341e6'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_021_1997_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_021',
              'rows': 13832,
              'parquetSha256': '49dfa5fdfbd4bf7c6f57e58d04a77be5e6cb5d0cb86b5c705827aec66a123688',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_024_1998_Awards.csv',
  'sha256': 'a048e2057367296e68691c1c3cc03b0f4b63b4a67e75c27e797d3ca80ed2bf51',
  'originalFileIds': ['ca3d8245-a8cf-4084-bd07-aaa050552a76'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_024_1998_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_024',
              'rows': 14586,
              'parquetSha256': 'ea59a0984ec502e26d397fb70ea0626cfda7721ec166d82506452b190a4385c6',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'f3_027_1999_Awards.csv',
  'sha256': 'ac7b82c2628df98de162d4ea5d5425ce90b94163629b042fe38e1807e6804633',
  'originalFileIds': ['d082be07-84d1-4d21-b752-c20eeacad94b'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/f3_027_1999_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_f3_027',
              'rows': 1794,
              'parquetSha256': '9c9c743076f23ed99a482f31a91e1d3807ecf04b60bc75f22ae7757f525af634',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'nserc_027_1999_Awards.csv',
  'sha256': '04602264c4665c73dbc1d82fc337964d0cafa641ebf397d62282ee3fc9b3f429',
  'originalFileIds': ['f700ddca-5429-4252-9435-722f6a2d8123'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/nserc_027_1999_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046_nserc_',
              'rows': 16692,
              'parquetSha256': '1da038a99d744eaa45128ce8c8d06e48c8c1b221c6bd1782fa533b573acfe24d',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'nserc_030_2000_Awards.csv',
  'sha256': '7700e929589992968e135c1e077ee65bb34b40e91a3811528c0bb8e4a1c78534',
  'originalFileIds': ['42ea0d82-a366-4902-bb51-15e65d2c3032'],
  'sourceRelativePath': 'Data Research/Data/raw/nserc/nserc_030_2000_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046__4',
              'rows': 17393,
              'parquetSha256': '81264504387b5fbf69c4c52d0feb9ea0182ac05797a2cce2ae4912dc044c9808',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C046',
  'datasetId': '44bb094d-1a6e-4344-91f1-29ba8e7fc19d',
  'filename': 'nserc_open_canada_package_metadata_c1b0f627-8c29-427c-ab73-33968ad9176e.json',
  'sha256': '3618a1ca4fb972cdafda4a2d7cf3f274b0d01cee74f6ef2e9d7bb5b0f0c287c3',
  'originalFileIds': ['947e0fb4-cebd-4087-b64d-4ed6d88a11fe'],
  'sourceRelativePath': 'Data '
                        'Research/Data/raw/nserc/nserc_open_canada_package_metadata_c1b0f627-8c29-427c-ab73-33968ad9176e.json',
  'tables': [{'tableName': 'nhhr_data_c046_564e910c80a9_zip_data_c046__7',
              'rows': 1,
              'parquetSha256': 'c992108e72a822e6f6962d23538107f165f8185beaa023de2e763e6626dbca89',
              'worksheet': ''}]}]
SOURCES.extend([{'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '033_2001_Awards.csv',
  'sha256': '21bb273e5ff7e88fc6670807ff34fd31c0408a1136b8fdd9b7c12e71837a13b1',
  'originalFileIds': ['44f51d15-9974-4f20-bf30-93ebf4a9b486'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/033_2001_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_033_20',
              'rows': 17022,
              'parquetSha256': 'bd305bed50837e6fcacfcdc6636124a4ff7834b9822940adf20062e6ec6e701a',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '036_2002_Awards.csv',
  'sha256': '57a02ff0b9ffa3d26bb0bb2588f714ac9fbab5f5b49c84f59d673c245f9a7458',
  'originalFileIds': ['b39ab8fb-1fc7-416c-9d40-bfe9b1a896f2'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/036_2002_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_036_20',
              'rows': 18102,
              'parquetSha256': 'dce12a362160a2c721dabdae18783dd6127c0b2f0fe57ee045c969f54d229c6d',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '039_2003_Awards.csv',
  'sha256': 'ab8d8db7511ed244a45ffe500f3ba4cc27ed4ee34c2a445b2a6365b032cd142d',
  'originalFileIds': ['66cff1d7-6541-4fc4-aae9-4c1198630068'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/039_2003_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_039_20',
              'rows': 20951,
              'parquetSha256': 'e49fdaa54cfd673714995d4fc874cbce74b27ce1e8922c0dbd4c639c832832f1',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '042_2004_Awards.csv',
  'sha256': '8001b0a2400320dc113088da467b41bf07cb0e8d70ca3b01744704d30418244c',
  'originalFileIds': ['ebf8d6b3-d144-4ecc-ae41-fa1e523f8f42'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/042_2004_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_042_20',
              'rows': 21169,
              'parquetSha256': '74c67e0cd777b492627be681be25784023a7e8d1c932025b90872860c8724c87',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '045_2005_Awards.csv',
  'sha256': '2712f189ab58271339baf7ff8599e4932f9796bcaa6af97c7a18b6d89a9cee8a',
  'originalFileIds': ['9b81c933-4178-406b-b359-67675cf466b9'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/045_2005_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_045_20',
              'rows': 22359,
              'parquetSha256': '3343d7801408cd7632ddd491eaf24502fa09bc85c36d400d9d79ef2b41e2f91a',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '048_2006_Awards.csv',
  'sha256': 'f40770242cd19d1f1f2565a43591035941aa5dd395b54c9749d243f6b35ac67c',
  'originalFileIds': ['f98b86b9-99e8-4ce1-acfc-53eb3b1a7900'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/048_2006_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_048_20',
              'rows': 17292,
              'parquetSha256': 'e54c3dbf9b98b278ee751ae044d47490c3b49aee7d38a279cb75e1b1c81216c2',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055__2',
              'rows': 5581,
              'parquetSha256': 'c5c07c2d76cd02507156579ec89fad8346bac8e116e6bfabc2b0dc671af042f0',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '051_2007_Awards.csv',
  'sha256': '8b4027dd4260d05fd4d9e18d71b5922b5fc9ce10833d450d37ceb693aa56f759',
  'originalFileIds': ['2b5a0a4f-62e6-4f81-9cff-51fe4ae58b36'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/051_2007_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_051_20',
              'rows': 9194,
              'parquetSha256': '575b99977bcd7813483b27329195e8951a0fd4768cffb8b6f23d9dd2389db801',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055__3',
              'rows': 14586,
              'parquetSha256': '8f3abacdeb69dc3cf7914ef8eba95728a69cc27b063c8048b8eb857cedb18bac',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '054_2008_Awards.csv',
  'sha256': '74d8f7789cf5120e962b90523abac4baa55c2284b8da62a4e79ab9b674151223',
  'originalFileIds': ['05d9ea25-c44d-4aa2-8f0f-494beca04a84', '7513e6de-b5c5-4b50-b89a-d879e1d2e3ed'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/054_2008_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_054_20',
              'rows': 9757,
              'parquetSha256': '2ede415d452947e2b418e2d0820facddb9cc92c1d03e82f61e2b45b0b205c3c7',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055__4',
              'rows': 15827,
              'parquetSha256': '939ffb8f1f04312cb39a40798c6eb641f96db3caea9140f3d56ed8c0d2ee5530',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '057_2009_Awards.csv',
  'sha256': '4318992bdafca2d0216be930b4b5abd27c6beab3fc3fa9fd0f323216e171c95c',
  'originalFileIds': ['345b355f-b813-422d-b0fb-5ac64baa89a6', 'f4587de2-494a-461e-a7ed-cfa966ebc4f4'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/057_2009_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055_057_20',
              'rows': 10425,
              'parquetSha256': 'b64a3401f43a7a6418d4e4c1979e310e7c19f7656fc3c7ec52fbf0199a3f458a',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_c8800259dfb4_zip_data_c055__5',
              'rows': 14133,
              'parquetSha256': '90ded79ebb98f91393b66f228581e7589f45106129b61c1eda117656626ce3c5',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '060_2010_Awards.csv',
  'sha256': 'e49b81f0dd1737c921b20e95e6591812f31d278bd58f3da32d8a97bc093c051d',
  'originalFileIds': ['a0c9d80a-77a1-40a5-ab4b-0a9a5a4c660e', '247599fc-46db-48d5-8e5e-fe0d3fe32d5c'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/060_2010_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_a2f5b4a5a514_zip_data_c055_060_20',
              'rows': 8541,
              'parquetSha256': '9fa789f19c3926bd96c51116cd3a121afeb56da6613d86b3f7cfca5d14240ab2',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_a2f5b4a5a514_zip_data_c055__2',
              'rows': 14439,
              'parquetSha256': '6451c86e54cf3e442fce132a5fc23d4d30362b271cc41a879e98ea83500491c3',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_a2f5b4a5a514_zip_data_c055__3',
              'rows': 1236,
              'parquetSha256': '8d68af04bcad5a805065ff76e8236136a7716e8b0b1bc392125946704623aa68',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '063_2011_Awards.csv',
  'sha256': '7727ed429892003ffdd6186988b7331cf5b7e19e5176fec0c48d5f85e0d709ce',
  'originalFileIds': ['d96c9230-ba15-48a9-b1ec-a10711e6e2b3'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/063_2011_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_a2f5b4a5a514_zip_data_c055_063_20',
              'rows': 8270,
              'parquetSha256': 'bf99fcd58af62a28564a978e4881afb66abdf119a387c0339b1767aedcaad66f',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_a2f5b4a5a514_zip_data_c055__4',
              'rows': 6306,
              'parquetSha256': '3098c93530131b9a2af9af877ff2a5fdf8d9424ebf7e752abcbdf66baec15cac',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '066_2012_Awards.csv',
  'sha256': 'dd861e57c26c769238aed7280bd6f40637899b4070943a24f5b822e0732177f2',
  'originalFileIds': ['46a6d1f1-09ae-46eb-a6db-1fdb1c604c42', 'b5f6bb2c-d693-4c6c-8dc4-f684de258530'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/066_2012_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_a2f5b4a5a514_zip_data_c055_066_20',
              'rows': 7197,
              'parquetSha256': 'f63ea273e280b302f3c66885227fcb5f23cc6899daa569994dd87b231c5a25ef',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_a2f5b4a5a514_zip_data_c055__5',
              'rows': 12633,
              'parquetSha256': '42faa034bc6c584ac758df11c92bca3e4aa8f8b9ebb197315e3c89e21a5f214b',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_a2f5b4a5a514_zip_data_c055__6',
              'rows': 3731,
              'parquetSha256': '523f91801f85e5a077c8ee5e0f9131ad1eb674f0407400df087a931a3b386c62',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '069_2013_Awards.csv',
  'sha256': '44c8c93795806107831316380fe922bc32beebe76cc31e7f7338b8b297a418fa',
  'originalFileIds': ['4e6b8c8a-8b8a-4ed2-8b7a-213fc63eb8f5', '30d7f02e-ac13-46a3-8e91-88d73bf46751'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/069_2013_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_9f8436790d33_zip_data_c055_069_20',
              'rows': 7669,
              'parquetSha256': '6c5d05711f2493cd09418393ecd34341420ac44b42032c4b601373800b68b065',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_9f8436790d33_zip_data_c055__2',
              'rows': 9544,
              'parquetSha256': '73b7559e87ce2bc09a2768b139a2436dd92f333fdd9f7e875c23ab5000d57323',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_9f8436790d33_zip_data_c055__3',
              'rows': 6354,
              'parquetSha256': 'c2afa021b05888be8f6871aa8651dd24e735563a2b835bbef3816104716750f7',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '072_2014_Awards.csv',
  'sha256': '4699d369a2840b508f1f725e51133dccc47e4cde06254cc637893c9286dd8f74',
  'originalFileIds': ['b3d80744-ab00-4bb2-b76c-27797dcae819', '065cd209-7001-4ad7-8160-1e04559b81ab'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/072_2014_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_9f8436790d33_zip_data_c055_072_20',
              'rows': 6907,
              'parquetSha256': '670e53007a100c4afa98956a2f2e313f2d3f82e3479df2a3c636180292b76943',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_9f8436790d33_zip_data_c055__4',
              'rows': 13038,
              'parquetSha256': 'dfab465f749502986a412105f98edd4002d0a67f296b5f7a4c2668673ff62d2b',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_9f8436790d33_zip_data_c055__5',
              'rows': 4266,
              'parquetSha256': '231655382f0a7d8dc42db4e1f50429ad3c8b63abd48236499feebabbb32318d1',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '075_2015_Awards.csv',
  'sha256': '3bcf0fad44da7b7226dcd065ef8b7bf64c998044a59f5c9e05b97b47a1950bff',
  'originalFileIds': ['71045db7-4c57-414d-8b23-a9eee156dab7', '69371ebf-f632-46a9-91ad-dd200daaac77'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/075_2015_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_9f8436790d33_zip_data_c055_075_20',
              'rows': 6819,
              'parquetSha256': 'af1ef52c73b281e6688e346892cbbe3adb6b0e3cb00777c32a4927f46ae4c42b',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_ba160cab4cb4_zip_data_c055_075_20',
              'rows': 10226,
              'parquetSha256': '654f559af85a4d44a053601aca8799f9eb62645993f8d39b1d292aa5bb8575e9',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_ba160cab4cb4_zip_data_c055__2',
              'rows': 7398,
              'parquetSha256': 'f9c9451081744142b30d9f24a466ff6e3dc8b4977bff56d49f233e529e40a183',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '078_2016_Awards.csv',
  'sha256': '5e327ba271f09d743677b50c920a42ac1518ce19fe8f85fb8b62f29490009b7c',
  'originalFileIds': ['fc2ba231-229d-46b4-9c96-31537302c4af', '560de763-f97d-4a6a-a854-3bb9f80ab50a'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/078_2016_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_5e4bf161be55_zip_data_c055_078_20',
              'rows': 7251,
              'parquetSha256': '92753cfebf01a5a1ad0c2d32656948a20897c99e9f3989ded73ccf8a7705baea',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_5e4bf161be55_zip_data_c055__2',
              'rows': 7207,
              'parquetSha256': '82d4c20fa0f0b952f46c2d46d49824ec1fb71257f2b3ed03ee074c5eda31d43f',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_5e4bf161be55_zip_data_c055__3',
              'rows': 10592,
              'parquetSha256': 'e36cf0b72b1fc224c8f30bcd0aa67963160f42896b71d56804e6142f00e65f73',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '081_2017_Awards.csv',
  'sha256': 'f7e9ae6a032edb46ba76145e866a35a8bb10f52249ea2bbf487830ae7121e152',
  'originalFileIds': ['8c3d278d-334a-4184-9613-791b3f88a6c2', '4a0708fe-f7f2-4e72-830f-497e6dd6231e'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/081_2017_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_5e4bf161be55_zip_data_c055_081_20',
              'rows': 6261,
              'parquetSha256': '2407674ea780835433c962dbf16ee8984ec6f5b5de7555465af6ccb3f785b58c',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_5e4bf161be55_zip_data_c055__4',
              'rows': 6621,
              'parquetSha256': 'bfb38a40e2461c05262fd184c952c49803f03015cab87a569c1b2ce864da69bf',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_5e4bf161be55_zip_data_c055__5',
              'rows': 11757,
              'parquetSha256': '969cc763e29c043b8b62580bf55b1d5e27dcac923bbf78857b1bd1d916c21849',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_5e4bf161be55_zip_data_c055__6',
              'rows': 829,
              'parquetSha256': 'eec56cc5a234b974460d4377dbf19f6ac933d145cde49e7fe88779b26ed42c09',
              'worksheet': ''}]},
 {'collectionId': 'DATA-C055',
  'datasetId': '1704b537-adf5-45c0-9aad-7b693dab88ce',
  'filename': '084_2018_Awards.csv',
  'sha256': '23d0edb78db5cc651271a95b070c9d669c03bfdf04dc674aae4bb334d3125e86',
  'originalFileIds': ['7a00626d-22fa-4299-b0e0-4dde9266164f', '3b0598f9-e94e-4e89-b7ca-4d802be45133'],
  'sourceRelativePath': 'Data Research/Data/raw/source_pull_2026-04-28/nserc/084_2018_Awards.csv',
  'tables': [{'tableName': 'nhhr_data_c055_ad98615c4407_zip_data_c055_084_20',
              'rows': 7940,
              'parquetSha256': '6d962cb5fe6e62bf3563b080c9c4f5aaba2db5a4c031743c30b5f712fe8e378e',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_ad98615c4407_zip_data_c055__2',
              'rows': 8124,
              'parquetSha256': 'ab91d74970dcc00642dafc53c7e8deac9db1508223152ce4ec2cb9aeef8051f3',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_ad98615c4407_zip_data_c055__3',
              'rows': 7931,
              'parquetSha256': '720f7553985e6da2f7420fc21b285e74091bc912a5b05b0d42fc61ce1ab2ff0a',
              'worksheet': ''},
             {'tableName': 'nhhr_data_c055_ad98615c4407_zip_data_c055__4',
              'rows': 2660,
              'parquetSha256': 'ed801ddef8645728fe199451836064b6a28fafbea334f3bf11b52d9585643cbc',
              'worksheet': ''}]}])
UNIVERSITIES={'University of British Columbia':('UBC / Vancouver','2'),'University of Calgary':('Calgary / Calgary','11'),'Dalhousie University':('Dalhousie / Halifax','79'),'University of Saskatchewan':('USask / Saskatoon','16'),'Lakehead University':('Lakehead / Thunder Bay','25'),'University of Northern British Columbia':('UNBC / Prince George','3'),'McMaster University':('McMaster / Hamilton','27')}
HOSPITALS={'Provincial Health Services Authority','Vancouver Coastal Health Authority','Alberta Health Services - Edmonton Zone','Alberta Health Services - Calgary Zone','Nova Scotia Health Authority'}
UNIVERSITY_URL='https://researchinfosource.com/cil/2025/top-50-research-universities/list'
HOSPITAL_URL='https://researchinfosource.com/cil/2025/top-40-research-hospitals/list'
CRA_URL='https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4033/t4033-completing-registered-charity-information-return-23.html'
RECOVERY_URL='https://www.nserc-crsng.gc.ca/opendata/nserc_grt_fyr2011_award.csv'
RECOVERY_PACKAGE_URL='https://open.canada.ca/data/api/action/package_show?id=c1b0f627-8c29-427c-ab73-33968ad9176e'
RECOVERY_DEFINITION_URL='https://www.nserc-crsng.gc.ca/opendata/NSERC_AWARD_DEFINITION.csv.xls.csv'
RECOVERY_RESOURCE_ID='22fcf163-1846-4f37-b5ef-0dab0acc5fed'
EXTERNAL_SOURCES=[
    dict(filename='nserc_grt_fyr2011_award.csv',url=RECOVERY_URL,sha256='bcce99ac5e8640acfd7c0b422c0f5b37fd2f6c85e719529e12caf86d0a5f2e16',bytes=36390655,origin='Official NSERC publisher recovery',resourceId=RECOVERY_RESOURCE_ID),
    dict(filename='NSERC_AWARD_DEFINITION.csv',url=RECOVERY_DEFINITION_URL,sha256='d2bec5c48f546a144b89e0d7ea9a25e635d5fce86689bbc4ed24862da09fec22',bytes=2973,origin='Official NSERC publisher dictionary'),
    dict(filename='open-canada-package.json',url=RECOVERY_PACKAGE_URL,sha256='3618a1ca4fb972cdafda4a2d7cf3f274b0d01cee74f6ef2e9d7bb5b0f0c287c3',origin='Official Open Government resource metadata'),
]
def require(condition,message):
    if not condition:raise ValueError(message)
def source(collection,filename):return next(s for s in SOURCES if s['collectionId']==collection and s['filename']==filename)
def read_locked(root,s):
    raw=(root/s['collectionId']/s['filename']).read_bytes();require(hashlib.sha256(raw).hexdigest()==s['sha256'],'Original source hash changed: '+s['filename']);return raw
def csv_rows(raw):
    try:text=raw.decode('utf-8-sig')
    except UnicodeDecodeError:text=raw.removeprefix(b'\xef\xbb\xbf').decode('latin1')
    return list(csv.DictReader(io.StringIO(text)))
def number(value,currency=False):
    text=str(value).replace('$','').replace(',','').strip() if currency else str(value)
    require(re.fullmatch(r'-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?',text) is not None,'Invalid source numeric value')
    result=Decimal(text);require(result.is_finite(),'Nonfinite source value');return result
def scalar(value):return int(value) if value==value.to_integral_value() else float(value)
def col(key,label,unit=None):return dict(key=key,label=label,type='number' if unit else 'text',**({'unit':unit} if unit else {}))
def dataset(id,title,s,rows,columns,metric,notes,geography='institution',entity='comparator',time='source_fiscal_year',url=None):
    return dict(id=id,title=title,description=title+'. Original reporting scope and measures remain separate from other funding or income views.',topic='Research context',geography=geography,status='observed',entityField=entity,timeField=time,defaultMetric=metric,timeLabel='Collected historical source',sourceName='NSERC original awards data' if s['collectionId'] in ['DATA-C046','DATA-C055'] else 'Research Infosource · collected 2025 publisher table',sourceUrl=url or 'https://open.canada.ca/data/en/dataset/c1b0f627-8c29-427c-ab73-33968ad9176e',datasetId=s['datasetId'],tableName='; '.join(t['tableName'] for t in s['tables']),notes=notes,columns=columns,rows=rows)
def prepare(input_root):
    loaded={s['filename']:read_locked(input_root,s) for s in SOURCES}
    external={s['filename']:read_locked(input_root,{**s,'collectionId':'EXTERNAL-NSERC-2011'}) for s in EXTERNAL_SOURCES}
    publisher_package=json.loads(external['open-canada-package.json'])['result']
    require(publisher_package['license_title']=='Open Government Licence - Canada','Recovered NSERC licence changed')
    publisher_resource=next(r for r in publisher_package['resources'] if r['id']==RECOVERY_RESOURCE_ID)
    require(publisher_resource['url']==RECOVERY_URL and publisher_resource['name']=='2011 Awards','Official 2011 resource identity changed')
    locations=json.loads((ROOT/'src/atlas/institutionLocations.json').read_text());labels={l['comparator'] for l in locations}
    require(all(v[0] in labels for v in UNIVERSITIES.values()),'Reviewed institutional aliases changed')
    # Dictionary proves that instalment fields describe numbered instalments;
    # source AwardAmount is retained without inferring payment or commitment.
    dictionary=csv_rows(loaded['f3_000_Table_definition_-_Awards.csv'])
    defs={r['physical name']:r[' logical name EN'] for r in dictionary}
    require(defs['AwardAmount']=='Award amount' and defs['Partie']=='Number of instalment' and defs['Nb_Partie']=='Number of total instalment','NSERC amount/instalment definition changed')
    require(external['NSERC_AWARD_DEFINITION.csv']==loaded['f3_000_Table_definition_-_Awards.csv'],'Official recovery dictionary differs from the collected scientific definitions')
    package=json.loads(loaded['nserc_open_canada_package_metadata_c1b0f627-8c29-427c-ab73-33968ad9176e.json']);package=package.get('result',package)
    require(package['license_title']=='Open Government Licence - Canada','NSERC source licence changed')
    def project(raw):
        reader=csv_rows(raw);header=reader[0].keys();fiscal=next((k for k in header if k in ['FiscalYear-Exercice-financier','FiscalYear-Exercice financier']),None);competition=next((k for k in header if k in ['CompetitionYear-Année-de-concours','CompetitionYear-Année de concours']),None)
        require(fiscal and competition,'NSERC fiscal/competition header changed')
        allow=['ApplicationID','OrganizationID','Institution-Établissement','AwardAmount','Partie','Nb_Partie']
        require(all(k in header for k in allow),'NSERC scientific header changed')
        return [(n,{**{k:r.get(k) for k in allow},'fiscal_year':r.get(fiscal),'competition_year':r.get(competition),'program_id':r.get('ProgramID'),'programme_group':r.get('GroupEN')}) for n,r in enumerate(reader,2)]
    small=project(loaded['f3_027_1999_Awards.csv']);large=project(loaded['nserc_027_1999_Awards.csv']);fields=['ApplicationID','OrganizationID','AwardAmount','Partie','Nb_Partie','fiscal_year','competition_year','Institution-Établissement']
    full=collections.Counter(tuple(r[k] for k in fields) for _,r in large);complete=0;truncated=[]
    for row,r in small:
        if all(r[k] is not None for k in fields):require(full[tuple(r[k] for k in fields)]>0,'1999 excerpt no longer reconciles with full export');complete+=1
        else:
            candidates=[v for _,v in large if all(r[k] is None or r[k]==v[k] for k in fields)]
            require(len(candidates)==1,'Truncated 1999 excerpt no longer reconciles');truncated.append(dict(sourceCsvRow=row,missingFields=[k for k in fields if r[k] is None]))
    require(len(small)==1794 and len(large)==16692 and complete==1793 and len(truncated)==1,'1999 export/excerpt coverage changed')
    duplicate_review=dict(fullExportRows=len(large),excerptRows=len(small),completeExcerptRowsMatchingFull=complete,truncatedExcerptRows=truncated,policy='Only the complete nserc_027_1999 export is used. The 1793 complete excerpt rows and one truncated row are supporting copies, never concatenated as new records.')
    groups=collections.defaultdict(list);source_counts=[];split_applications={};scientific_keys=set()
    for s in SOURCES:
        if s['collectionId']!='DATA-C046' or not s['filename'].endswith('Awards.csv') or 'definition' in s['filename'] or s['filename']=='f3_027_1999_Awards.csv':continue
        records=project(loaded[s['filename']]);year=re.search(r'(199\d|2000)',s['filename']).group(1);source_counts.append(dict(filename=s['filename'],sourceRows=len(records),sourceFiscalYear=year));apps=collections.defaultdict(set)
        for index,r in records:
            require(r['fiscal_year']==year and re.fullmatch(r'\d{4}',r['competition_year'] or ''),'NSERC source period missing or changed')
            amount=number(r['AwardAmount']);require(r['ApplicationID'] and r['OrganizationID'],'NSERC source identity missing')
            for key in ['Partie','Nb_Partie']:require(r[key]=='NA' or re.fullmatch(r'\d+',r[key] or ''),'NSERC instalment token changed')
            key=(year,r['ApplicationID'],r['OrganizationID'],r['Partie'],r['Nb_Partie']);require(key not in scientific_keys,'NSERC duplicate scientific source key');scientific_keys.add(key);apps[r['ApplicationID']].add(r['OrganizationID'])
            name=r['Institution-Établissement']
            if name not in UNIVERSITIES:continue
            comparator,code=UNIVERSITIES[name];require(r['OrganizationID']==code,'Dated exact NSERC institution/code identity changed')
            groups[(name,year)].append(dict(index=index,application=r['ApplicationID'],amount=amount,competition=r['competition_year'],part=r['Partie'],total_parts=r['Nb_Partie'],source=s['filename']))
        split_applications[year]=sum(len(v)>1 for v in apps.values())
    annual=[];bindings=[]
    for (name,year),records in sorted(groups.items(),key=lambda x:(x[0][1],x[0][0])):
        known=sum(r['part']!='NA' for r in records)
        annual.append(dict(comparator=UNIVERSITIES[name][0],source_institution_name=name,organization_id=UNIVERSITIES[name][1],fiscal_year=year,award_amount_cad=scalar(sum((r['amount'] for r in records),Decimal(0))),award_records=len(records),distinct_applications=len({r['application'] for r in records}),numbered_installment_records=known,installment_unspecified_records=len(records)-known,competition_year_min=min(r['competition'] for r in records),competition_year_max=max(r['competition'] for r in records)))
        bindings.append(dict(comparator=UNIVERSITIES[name][0],sourceFiscalYear=year,filename=records[0]['source'],sourceCsvRows=[r['index'] for r in records]))
    scope='Current reviewed campus points provide whole-institution context only. They do not locate historical funded projects, allocate amounts to buildings/residents or establish health research capacity.'
    notes=[
      'Exact source institution names and OrganizationID pairs are checked for each fiscal record. Observed groups are retained; missing institution-years are not manufactured as zero. The view covers 1991–2000 and does not duplicate the existing recent NSERC window.',
      'AwardAmount is the publisher field, summed within institution and source fiscal-year code. Numbered instalments and unspecified NA instalments remain distinguished. These are recorded fiscal funding amounts, not an independently established total lifetime commitment or actual cash-payment series.',
      'Competition year is a separate original field and can differ from source fiscal year; minimum and maximum competition years are retained as metadata. Original four-digit fiscal codes are not relabelled as calendar years or an inferred start/end date.',
      'A single application can have institution-specific allocations. The validated key retains fiscal year, application, OrganizationID and instalment fields. Deduplicating globally by application would discard valid allocations. Co-applicant and partner rows are excluded.',
      'The 1999 collection contains a full 16,692-row export and a 1,794-row truncated excerpt. The excerpt has 1,793 complete matching records and one incomplete record. Only the full export contributes observations.',
      'Amounts retain nominal source Canadian-dollar reporting context; no inflation conversion or cross-agency addition is performed. Applicant names, departments, titles, keywords and summaries are excluded.',scope]
    s=source('DATA-C046','f3_003_1991_Awards.csv');historical=dataset('nserc-awards-history','Historical NSERC fiscal funding records · 1991–2000',s,annual,[col('comparator','Institution / city'),col('fiscal_year','Source fiscal-year code'),col('award_amount_cad','Recorded fiscal award amounts','CAD'),col('award_records','Source award records','records'),col('distinct_applications','Distinct applications at institution / fiscal code','applications'),col('numbered_installment_records','Records with numbered instalments','records'),col('installment_unspecified_records','Records with unspecified instalments','records'),col('source_institution_name','Original institution name'),col('organization_id','Source OrganizationID'),col('competition_year_min','Earliest recorded competition year'),col('competition_year_max','Latest recorded competition year')],'award_amount_cad',notes,time='fiscal_year');historical['timeLabel']='Original fiscal codes 1991–2000 · historical allocations';historical['tableName']='; '.join(t['tableName'] for s in SOURCES if s['collectionId']=='DATA-C046' and s['filename'].endswith('Awards.csv') and 'definition' not in s['filename'] and s['filename']!='f3_027_1999_Awards.csv' for t in s['tables'])

    # C055 covers 2001–2018; only its truncated 2011 capture is replaced by a
    # separately attributed complete official publisher original.
    newer_groups=collections.defaultdict(list);newer_sources=[];newer_keys=set();collected_gaps=[];recovery=None
    for src in SOURCES:
        if src['collectionId']!='DATA-C055':continue
        raw=loaded[src['filename']];records=project(raw);year=re.search(r'(20\d{2})',src['filename']).group(1)
        anonymous=sum(r['ApplicationID'] in ['', 'NA'] for _,r in records)
        groups_by_program=collections.Counter(r['programme_group'] for _,r in records)
        if year=='2011':
            missing=[key for key,value in records[-1][1].items() if value is None]
            require(len(records)==14576 and not raw.endswith(b'\n') and missing==['Partie','Nb_Partie'],'C055 2011 truncation evidence changed; review before using year')
            gap=dict(sourceFiscalYear=year,filename=src['filename'],originalSha256=src['sha256'],sourceRows=len(records),lastSourceCsvRow=records[-1][0],missingScientificFields=missing,allMissingSourceColumns=['ResearchSubjectCode','ResearchSubjectGroupEN','ResearchSubjectGroupFR','ResearchSubjectEN','ResearchSubjectFR','Partie','Nb_Partie','ApplicationTitle','Keyword','ApplicationSummary'],fileEndsWithNewline=False,reason='Collected original ends mid-record and omits later records. It remains excluded from scientific totals; fiscal 2011 is independently recovered from the complete official publisher export.')
            collected_gaps.append(gap)
            official=external['nserc_grt_fyr2011_award.csv'];all_publisher_rows=csv_rows(official)
            require(official.startswith(raw) and official.endswith(b'\n'),'Official 2011 export is not a complete continuation of the collected prefix')
            require(len(official)==EXTERNAL_SOURCES[0]['bytes'] and len(all_publisher_rows)==23312,'Official 2011 captured byte/CSV coverage changed')
            require(all(None not in r and all(v is not None for v in r.values()) for r in all_publisher_rows),'Official 2011 export has incomplete CSV fields')
            blank_rows=[row for row,r in enumerate(all_publisher_rows,2) if all(value=='' for value in r.values())]
            require(len(blank_rows)==47,'Official 2011 blank delimiter-row coverage changed')
            published=project(official);blank_set=set(blank_rows);published=[(row,r) for row,r in published if row not in blank_set]
            require(len(published)==23265,'Official 2011 complete scientific record count changed')
            comparison_fields=fields+['program_id','programme_group']
            require(all(all(r[k]==published[i][1][k] for k in comparison_fields) for i,(_,r) in enumerate(records[:-1])),'Official 2011 scientific rows differ from the complete collected prefix')
            require(all(value is None or value==published[len(records)-1][1][key] for key,value in records[-1][1].items()),'Official 2011 row fails to complete the truncated scientific record')
            recovery=dict(origin='Official NSERC publisher recovery',resourceId=RECOVERY_RESOURCE_ID,url=RECOVERY_URL,filename='nserc_grt_fyr2011_award.csv',sha256=EXTERNAL_SOURCES[0]['sha256'],bytes=len(official),csvRows=len(all_publisher_rows),completeScientificRows=len(published),whollyEmptyDelimiterRows=len(blank_rows),excludedBlankSourceCsvRows=blank_rows,fileEndsWithNewline=True,scientificColumnCount=len(all_publisher_rows[0]),bytePrefixMatch=True,matchingCompleteCollectedRows=len(records)-1,truncatedFinalRowCompleted=True,dictionaryHashMatchesCollected=True,independentRetrieval='Uninterrupted HTTP 200 GET and nonoverlapping HTTP 206 byte-range reconstruction yielded the identical pinned SHA256 and byte length.',originalTruncatedCapture=gap,licence='Open Government Licence - Canada',licenceUrl=publisher_package['license_url'])
            recovery['retrievalEvidence']=dict(fullGetHttpStatus=200,rangeHttpStatus=206,rangeParts=37,checkedContentLength=36390655,publisherLastModified='Thu, 02 Jun 2022 14:47:31 GMT',identicalFullAndRangeSha256=EXTERNAL_SOURCES[0]['sha256'])
            records=published;filename=recovery['filename'];origin='Official NSERC publisher recovery';anonymous=sum(r['ApplicationID'] in ['', 'NA'] for _,r in records);groups_by_program=collections.Counter(r['programme_group'] for _,r in records)
        else:filename=src['filename'];origin='NHHR Zoer collected original'
        newer_sources.append(dict(filename=filename,sourceRows=len(records),sourceFiscalYear=year,anonymousSourceRows=anonymous,programmeGroups=dict(groups_by_program),originalParts=1 if year=='2011' else len(src['originalFileIds']),sourceOrigin=origin,**({'externalResourceId':RECOVERY_RESOURCE_ID,'sha256':EXTERNAL_SOURCES[0]['sha256']} if year=='2011' else {})))
        for row,r in records:
            require(r['fiscal_year']==year and all(r[k] is not None for k in ['ApplicationID','OrganizationID','AwardAmount','Partie','Nb_Partie']),'C055 incomplete scientific row outside withheld year')
            amount=number(r['AwardAmount'])
            require(re.fullmatch(r'\d{4}',r['competition_year'] or '') is not None or r['competition_year'] in ['', 'NA','0'],'C055 unknown competition-year token')
            for key in ['Partie','Nb_Partie']:
                require(r[key] in ['', 'NA'] or re.fullmatch(r'\d+(?: & \d+)*',r[key]) is not None,'C055 unknown instalment token')
            name=r['Institution-Établissement']
            if name not in UNIVERSITIES:continue
            require(r['OrganizationID']==UNIVERSITIES[name][1],'C055 dated exact institution/code pair changed')
            # Applications can receive different programme allocations or amount
            # components within one instalment. Do not deduplicate by application.
            key=(year,r['ApplicationID'],r['OrganizationID'],r['program_id'],r['competition_year'],r['Partie'],r['Nb_Partie'],r['AwardAmount'])
            require(key not in newer_keys,'C055 repeated complete selected financial key needs source review');newer_keys.add(key)
            part=r['Partie'];numbered=bool(re.fullmatch(r'[1-9]\d*(?: & [1-9]\d*)*',part or ''))
            newer_groups[(name,year)].append(dict(index=row,application=r['ApplicationID'],amount=amount,competition=r['competition_year'],part=part,total_parts=r['Nb_Partie'],numbered=numbered,source=filename,origin=origin))
    newer_rows=[];newer_bindings=[]
    for (name,year),records in sorted(newer_groups.items(),key=lambda x:(x[0][1],x[0][0])):
        apps={r['application'] for r in records if r['application'] not in ['', 'NA']};known=sum(r['numbered'] for r in records);competitions=[r['competition'] for r in records if re.fullmatch(r'\d{4}',r['competition'] or '')]
        newer_rows.append(dict(comparator=UNIVERSITIES[name][0],source_institution_name=name,organization_id=UNIVERSITIES[name][1],fiscal_year=year,award_amount_cad=scalar(sum((r['amount'] for r in records),Decimal(0))),award_records=len(records),distinct_applications=len(apps),numbered_installment_records=known,installment_unspecified_records=len(records)-known,anonymous_source_records=sum(r['application'] in ['', 'NA'] for r in records),competition_year_unspecified_records=sum(not re.fullmatch(r'\d{4}',r['competition'] or '') for r in records),competition_year_min=min(competitions) if competitions else None,competition_year_max=max(competitions) if competitions else None))
        newer_rows[-1]['source_origin']=records[0]['origin']
        newer_bindings.append(dict(comparator=UNIVERSITIES[name][0],sourceFiscalYear=year,filename=records[0]['source'],sourceOrigin=records[0]['origin'],sourceCsvRows=[r['index'] for r in records]))
    require(len(newer_rows)==126 and len(collected_gaps)==1 and recovery is not None,'C055 plus publisher recovery year/institution coverage changed')
    newer_notes=[
      'All eighteen collected annual originals from 2001–2018 were downloaded using actual dataset/original-file IDs, including ten multipart sources reconstructed in catalogue order and hash-verified. Seventeen complete collected years supply 119 institution/fiscal observations. Seven fiscal-2011 observations are independently recovered from the complete official NSERC publisher export; this mixed-origin view retains source_origin for every row.',
      'The collected 2011 original remains truncated at 14,576 partial records and is excluded from totals. The official 36,390,655-byte export is an exact continuation of those bytes: all 14,575 complete scientific rows match, the partial last row is completed, and the full CSV contains 23,265 complete fiscal-2011 records plus 47 wholly empty delimiter rows. Independent full-file and byte-range downloads have identical hashes. No partial totals or partner rows were used to fill the year.',
      'The original financial row grain retains fiscal year, application identifier, paid organization, programme, competition year, instalment token and amount. One application can have more than one programme or financial component. Source records are retained and amounts summed within institution/fiscal code; application IDs are not used to erase different allocations.',
      'Distinct applications count identifiable source IDs only. Blank or NA IDs remain anonymous source records and are never assigned invented application identifiers. The complete source files contain such allocations outside these selected seven institutions; the selected groups have zero anonymous records.',
      'Positive numbered and combined instalment tokens such as 2 & 3 count one original financial row. Zero, blank and NA instalment tokens are retained as unnumbered/unspecified metadata, not zero funding. Amounts are never multiplied or divided by instalment counts.',
      'Competition years differ from source fiscal codes. Source zero/blank/NA competition codes remain unspecified, with counts retained separately from the earliest/latest numbered year. These are recorded NSERC fiscal award amounts across programmes, not independently validated lifetime commitments, health-only funding or an actual cash-payment series. Source programme coverage and institutional identity must be retained when comparing periods.',
      'This view is separate from the 1991–2000 C046 and recent 2019–2024 extracts; overlapping copies are not added. Original source record counts do not establish unique researchers or projects.',scope]
    src=next(v for v in SOURCES if v['collectionId']=='DATA-C055' and '2001' in v['filename']);newer=dataset('nserc-awards-2001-2018','NSERC fiscal funding records · 2001–2018',src,newer_rows,historical['columns']+[col('anonymous_source_records','Anonymous source records · metadata'),col('competition_year_unspecified_records','Records without a numbered competition year · metadata'),col('source_origin','Original source origin')],'award_amount_cad',newer_notes,time='fiscal_year');newer['timeLabel']='Original fiscal codes 2001–2018 · official 2011 recovery';newer['tableName']='; '.join(t['tableName'] for src in SOURCES if src['collectionId']=='DATA-C055' and '2011' not in src['filename'] for t in src['tables'])+'; official publisher CSV nserc_grt_fyr2011_award.csv (2011 recovery; outside Zoer tables)';newer['sourceOrigin']='mixed';newer['sourceName']='NSERC collected fiscal award records + official 2011 recovery';newer['supplementalSources']=[dict(name='Official NSERC 2011 Awards',url=RECOVERY_URL,scope='Complete 2011 fiscal export recovered from the publisher; the collected Zoer original remains truncated.')]
    # Publisher university facts are bounded to seven exact comparators.
    normalized=csv_rows(loaded['research_infosource_2025_rankings_normalized.csv']);univ=csv_rows(loaded['research_infosource_2025_top_50_universities_browser.csv']);hospital=csv_rows(loaded['research_infosource_2025_top_40_hospitals_browser.csv']);require(len(normalized)==90 and len(univ)==50 and len(hospital)==40,'Rank-table coverage changed')
    uni=[];uni_bindings=[]
    for n,r in enumerate(univ,2):
        name=r['university']
        if name not in UNIVERSITIES:continue
        match=[v for v in normalized if v['entity_type']=='university' and v['entity_name']==name];require(len(match)==1,'Normalized university source identity changed');v=match[0]
        for key,normal in [('sponsored_research_income_fy2024_000','current_research_amount_000'),('sponsored_research_income_fy2023_000','prior_research_amount_000'),('research_intensity_per_faculty_000','research_intensity_per_faculty_000'),('research_intensity_per_grad_student_000','research_intensity_per_grad_student_000')]:require(number(r[key],True)==number(v[normal],True),'Normalized university amount/ratio differs')
        uni.append(dict(comparator=UNIVERSITIES[name][0],source_institution_name=name,source_fiscal_year='2024',income_per_faculty_cad=scalar(number(r['research_intensity_per_faculty_000'],True)*1000),income_per_grad_student_cad=scalar(number(r['research_intensity_per_grad_student_000'],True)*1000),sponsored_research_income_cad=scalar(number(r['sponsored_research_income_fy2024_000'],True)*1000),reported_income_change_pct=scalar(number(r['pct_change_2023_2024'])),prior_source_fiscal_year='2023',prior_income_cad=scalar(number(r['sponsored_research_income_fy2023_000'],True)*1000),rank_2024=r['rank_2024'],rank_2023=r['rank_2023'],tier=r['tier'],province=r['province']))
        uni_bindings.append(dict(comparator=UNIVERSITIES[name][0],sourceCsvRow=n,normalizedSourceRow=normalized.index(v)+2))
    require(len(uni)==7,'University comparator coverage changed')
    uni_notes=['Seven selected university facts from the collected 2025 publisher ranking are reconciled with the C017 normalized copy. The publisher reports fiscal 2024 income with academic-year 2023–2024 headcount denominators; a headcount is not an FTE or a researcher salary.',
      'Faculty coverage includes full- and part-time full, associate and assistant ranks. Graduate enrollment includes full- and part-time graduate programs, excluding health internships/residencies and first professional programs. No denominator is inferred by dividing rounded ratios into income.',
      'Original thousand-CAD income and ratios are multiplied by 1,000, preserving reported precision. Percent change and ranks are the published values; source ranks and prior income remain metadata rather than measures of current capacity.',
      'The publisher includes main-university affiliated organizations where applicable and notes that prior fiscal figures may be revised. Its captured Dalhousie income differs from the existing CAUBO extract; both sources retain their own definitions and revisions. These income figures must not be added to CIHR payments, NSERC fiscal amounts or CFI contributions.',
      'This is a small factual comparison, with source attribution; the publisher retains copyright and no open redistribution licence was found in the collected material. The full ranking table, logos and layout are not reproduced.',scope]
    s=source('DATA-C045','research_infosource_2025_top_50_universities_browser.csv');universities=dataset('university-research-intensity','University research income and headcount intensity · publisher FY2024',s,uni,[col('comparator','Institution / city'),col('source_fiscal_year','Publisher fiscal-year label'),col('income_per_faculty_cad','Published income per faculty headcount','CAD / faculty'),col('income_per_grad_student_cad','Published income per graduate student headcount','CAD / student'),col('sponsored_research_income_cad','Publisher sponsored-research income','CAD'),col('reported_income_change_pct','Publisher income change from FY2023','%'),col('source_institution_name','Publisher institution name'),col('prior_source_fiscal_year','Prior publisher fiscal year'),col('prior_income_cad','Prior reported income · metadata (CAD)'),col('rank_2024','Published FY2024 rank · metadata'),col('rank_2023','Published FY2023 rank · metadata'),col('tier','Publisher tier'),col('province','Source province')],'income_per_faculty_cad',uni_notes,url=UNIVERSITY_URL);universities['timeLabel']='Publisher fiscal 2024 · academic headcounts 2023–2024'
    health=[];health_bindings=[]
    for n,r in enumerate(hospital,2):
        name=r['hospital']
        if name not in HOSPITALS:continue
        match=[v for v in normalized if v['entity_type']=='hospital' and v['entity_name']==name];require(len(match)==1,'Normalized hospital source identity changed');v=match[0]
        for key,normal in [('research_spending_fy2024_000','current_research_amount_000'),('research_spending_fy2023_000','prior_research_amount_000'),('research_intensity_per_researcher_000','research_intensity_per_researcher_000')]:require(number(r[key],True)==number(v[normal],True),'Normalized hospital amount/ratio differs')
        share=r['research_spending_as_pct_total_hospital_spending'];require(share=='na' or re.fullmatch(r'\d+(?:\.\d+)?',share),'Unknown hospital share marker')
        health.append(dict(organization_name=name,province=r['province'],source_fiscal_year='2024',research_spending_cad=scalar(number(r['research_spending_fy2024_000'],True)*1000),spending_per_researcher_cad=scalar(number(r['research_intensity_per_researcher_000'],True)*1000),research_spending_share_pct=None if share=='na' else scalar(number(share)),research_spending_share_raw=share,reported_spending_change_pct=scalar(number(r['pct_change_2023_2024'])),prior_source_fiscal_year='2023',prior_spending_cad=scalar(number(r['research_spending_fy2023_000'],True)*1000),rank_2024=r['rank_2024'],rank_2023=r['rank_2023']))
        health_bindings.append(dict(organizationName=name,sourceCsvRow=n,normalizedSourceRow=normalized.index(v)+2))
    require(len(health)==5,'Selected health-organization source coverage changed')
    health_notes=['Five selected public-health organizations or administrative zones retain the publisher fiscal 2024 spending and researcher-intensity facts. These are organizational observations, including affiliated hospitals/research centres where applicable, not individual buildings.',
      'Research spending includes direct and indirect support from internal and external sources, based on the publisher public-health organization survey. It is distinct from university sponsored-research income and hospital clinical operating costs.',
      'The publisher researcher denominator includes full- and part-time active researchers and clinician researchers with faculty appointments in fiscal 2024. It is a headcount, not FTE, salary, funded posts or people available for NHHR.',
      'Amounts and headcount ratios retain original thousand-CAD precision after conversion to CAD. Published percentages are already percentage points. The two source na spending-share cells remain null, never zero; published prior amounts/ranks are retained as metadata.',
      'No point map is supplied: PHSA/VCH authorities and Alberta service zones cannot be allocated to a single hospital or university campus. The five organizations are selected comparisons, not complete Canadian or Northern Health coverage; unlisted organizations are not zero.',
      'The publisher retains copyright. Only bounded selected facts and source links are released, without recreating the full ranking table, logos or design.']
    s=source('DATA-C045','research_infosource_2025_top_40_hospitals_browser.csv');hospitals=dataset('hospital-research-organizations','Health-organization research spending and headcount intensity · FY2024',s,health,[col('organization_name','Health organization / zone'),col('source_fiscal_year','Publisher fiscal-year label'),col('research_spending_cad','Publisher research spending','CAD'),col('spending_per_researcher_cad','Published spending per researcher headcount','CAD / researcher'),col('research_spending_share_pct','Published share of total hospital spending','%'),col('reported_spending_change_pct','Publisher spending change from FY2023','%'),col('research_spending_share_raw','Original spending-share cell'),col('province','Source province'),col('prior_source_fiscal_year','Prior publisher fiscal year'),col('prior_spending_cad','Prior reported spending · metadata (CAD)'),col('rank_2024','Published FY2024 rank · metadata'),col('rank_2023','Published FY2023 rank · metadata')],'research_spending_cad',health_notes,'none','organization_name',url=HOSPITAL_URL);hospitals['timeLabel']='Publisher fiscal 2024 · organizational survey scope'
    datasets=[historical,newer,universities,hospitals];coverage=dict(datasetCount=4,loadedRows=sum(len(d['rows']) for d in datasets),rowsByDataset={d['id']:len(d['rows']) for d in datasets})
    # CRA retains only exact public university identities and scientific codes.
    identities=csv_rows(loaded['cra_t3010_2023_ident_update.csv']);finance=csv_rows(loaded['cra_t3010_2023_financial_d_and_schedule_6_updated.csv']);compact=csv_rows(loaded['cra_t3010_2023_charity_finance_compact.csv']);charity=[]
    allowed_names={'UNIVERSITY OF NORTHERN BRITISH COLUMBIA','UNIVERSITY OF BRITISH COLUMBIA','THE GOVERNORS OF THE UNIVERSITY OF CALGARY','DALHOUSIE UNIVERSITY','UNIVERSITY OF SASKATCHEWAN','LAKEHEAD UNIVERSITY','MCMASTER UNIVERSITY',"Northern Ontario School of Medicine University / Université de l'École de médecine du Nord de l'Ontario"}
    for ident in identities:
        if ident['Legal Name'] not in allowed_names:continue
        ff=[r for r in finance if r['BN']==ident['BN']];require(len(ff)==1,'CRA university fiscal row ambiguity');f=ff[0];cc=[r for r in compact if r['BN']==ident['BN']];require(len(cc)==1,'CRA compact identity ambiguity');c=cc[0]
        require(c['total_assets_4500']==f['4500'] and c['total_liabilities_4700']==f['4700'] and c['total_revenue_4950']==f['4950'],'CRA compact code evidence changed')
        charity.append(dict(legalName=ident['Legal Name'],bn=ident['BN'],fiscalPeriodEnd=f['FPE'],sourceSection=f['SectionUsed'],originalReportedFields={k:f[k] for k in ['4200','4350','4700','4950']},financialAmountsReleased=False))
    require(len(charity)==8,'CRA institution identity coverage changed')
    cra=dict(status='blocked',originalSourceCodeDefinitions={'4200':'Total assets','4350':'Total liabilities','4700':'Total revenue','4950':'Total expenditures'},guideUrl=CRA_URL,roundingDefinition='The CRA 2023 guide requires amounts rounded to single Canadian dollars.',compactError='C017 compact labels 4500 as total assets, 4700 as total liabilities and 4950 as total revenue. Original CRA codes instead use 4200,4350,4700,4950; the compact labels are not authoritative.',institutionEvidence=charity,reason='The UNBC return reports 137631 at revenue line4700 and 132365 at expenditure line4950. The numerical scale may reflect a thousand-dollar filing convention, but no validated conversion is supplied by this original. No blanket monetary view or silent x1000 correction is released. Registered-charity accounts also include all activities and are not research-only finance.')
    receipts={}
    for collection in ['DATA-C017','DATA-C043','DATA-C045','DATA-C046','DATA-C055']:
        descriptor=json.loads((input_root/(collection+'-metadata.json')).read_bytes())['dataset'];require(descriptor['id']==next(s['datasetId'] for s in SOURCES if s['collectionId']==collection) and descriptor['status']=='ready','Dataset endpoint identity/status changed');receipts[collection]=dict(url=HOST+'/api/datasets/'+descriptor['id'],datasetId=descriptor['id'],artifactVersion=descriptor['artifactVersion'],responseSha256=hashlib.sha256((input_root/(collection+'-metadata.json')).read_bytes()).hexdigest(),httpStatus=200)
    provenance=dict(reviewedAt='2026-10-12',manifestUrl=MANIFEST,catalogueDatasetId=CATALOGUE,originalSources=SOURCES,externalSources=EXTERNAL_SOURCES,datasetReceipts=receipts,privacy='Only institutional/public organization measures, exact scientific source keys and numeric source-row references. No applicant, co-applicant, director, contact, participant or source case rows.',coverage=coverage,nserc=dict(sourceFiles=source_counts,allowedFields=fields,definitions={k:defs[k] for k in ['FiscalYear-Exercice financier','CompetitionYear-Année de concours','AwardAmount','Partie','Nb_Partie','installment']},duplicate1999=duplicate_review,splitApplicationGroupsByFiscalYear=split_applications,rowBindings=bindings),nserc2001To2018=dict(sourceFiles=newer_sources,allowedFields=fields+['program_id','programme_group'],selectedFinancialKey=['fiscal_year','ApplicationID','OrganizationID','program_id','competition_year','Partie','Nb_Partie','AwardAmount'],withheldPeriods=[],collectedSourceGaps=collected_gaps,official2011Recovery=recovery,rowBindings=newer_bindings,selectedAnonymousSourceRecords=sum(r['anonymous_source_records'] for r in newer_rows)),universityRanking=dict(sourceRows=50,selectedRows=len(uni),rowBindings=uni_bindings,publisherDefinitionUrl=UNIVERSITY_URL,normalizedSourceCollection='DATA-C017',reuse='Bounded factual comparisons only; publisher copyright retained, no open licence represented.'),hospitalRanking=dict(sourceRows=40,selectedRows=len(health),rowBindings=health_bindings,explicitMissingShareRows=sum(r['research_spending_share_pct'] is None for r in health),publisherDefinitionUrl=HOSPITAL_URL,geography='No facility geometry allocation'),craReview=cra)
    def review(c,status,summary,mapping,needs,cannot,views):return dict(collectionId=c,datasetId=receipts[c]['datasetId'],status=status,summary=summary,mapConnection=mapping,needs=needs,cannot=cannot,views=views,inspectionScope='Fresh authorized dataset endpoint and canonical file/table catalogue, full hash verification for the selected originals; scientific fields parsed with explicit allowlists. Only released institutional/organization measures are validated. Personal or director records are excluded.',evidence=[dict(kind='dataset-api',**receipts[c])]+[dict(kind='hash-verified-original',**s) for s in SOURCES if s['collectionId']==c])
    report=dict(reviewedAt='2026-10-12',scope='Supplemental reviews preserve existing released scopes, resolve selected historical/ranking source candidates, and record raw CRA financial-code/unit issues. Individual source records are not public extracts.',reviews=[
      review('DATA-C046','connected',f'Ten complete fiscal award files yield {len(annual)} observed institution/year groups. Numbered/NA instalments and competition-year ranges are retained; 1999 truncated excerpt is excluded after reconciliation.','Exact dated institution names/OrganizationID pairs use current reviewed campus representatives only.',['Older historical location assumptions are not resolved by current campus coordinates. The source window remains separate from the fully reviewed C055 2001–2018 extension and recent 2019–2024 extract.'],['Awards/fiscal allocations are not independently verified lifetime commitments or actual cash payments; different institutions sharing an application retain allocations. No co-applicant/person map.'],['nserc-awards-history']),
      review('DATA-C055','connected',f'All 18 collected annual originals 2001–2018 fully reconstructed/hash-verified; 17 complete years yield 119 groups. The truncated collected 2011 file is excluded and independently replaced by seven groups from the complete official NSERC 2011 publisher export, yielding {len(newer_rows)} mixed-origin observations. Scientific row grain is preserved.','Seven exact institutional IDs use current reviewed campus context; no allocation to historical facilities.',['The 2011 publisher recovery is outside Zoer: retain distinct origin/resource/hash provenance and the original truncation audit. Preserve original fiscal codes and unknown/combined instalment tokens.'],['Do not treat the truncated 2011 capture as a real funding decline, deduplicate different programmes by application ID, or invent IDs for anonymous source allocations.'],['nserc-awards-2001-2018']),
      review('DATA-C017','connected','Existing CAUBO expenditure/income scopes remain intact. Ninety normalized ranking rows reconcile with original C045 facts for selected extracts. Compact CRA financial field labels are incorrect and not used as money measures.','Previously reviewed exact institution/campus context remains; normalized copies add no independent observations.',['Use C045 publisher definitions for ranking/intensity facts; validate C043 raw code meanings and institution filing units before charity-finance amounts.'],['Do not duplicate CAUBO or ranking copies, use mislabeled compact totals or reinterpret ratios as staff/salaries.'],['research-expenditures']),
      review('DATA-C045','connected','Original50-university/40-health-organization publisher tables support seven university intensity facts and five bounded health-organization comparisons; selected values reconcile to C017 normalized copies.','Seven institution points provide context. Health authorities/zones remain nonspatial organizational records.',['Full tables and proprietary layouts/logos are not reproduced; wider reuse requires publisher terms/permission. Preserve headcount denominators and publisher revisions.'],['Not health-only income, FTEs, salaries, available staff, hospital beds or NHHR benefits. Do not allocate authority/zone totals to one hospital.'],['university-research-intensity','hospital-research-organizations']),
      review('DATA-C043','candidate','Three safe non-director originals fully hash-verified. Eight exact university legal entities join by BN; source definitions correct compact label errors, but UNBC reported amount scale prevents a validated broad monetary release.','Exact BN/legal-entity/FPE observation, distinct from university research/campus scope.',['Resolve original filing currency/unit practice for UNBC through the filed return/audited accounts; confirm all-activity legal-entity scope. Directors remain excluded.'],['No implicit x1000 correction, no research-only interpretation or campus allocation of whole-charity finance.'],[])],craReview=cra,nsercWithheldPeriods=[],nsercCollectedSourceGaps=collected_gaps,nserc2011Recovery=recovery)
    report['reviews'][1]['evidence'] += [dict(kind='official-publisher-recovery',**entry) for entry in EXTERNAL_SOURCES]
    report['reviews'][1]['sourceOrigin']='mixed'
    return dict(datasets=datasets,snapshot=coverage),provenance,report

def fetch(url,headers):
    require(url.startswith(HOST+'/api/'),'Refresh endpoint outside reviewed authorized Zoer API')
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=90) as r:return r.read()
def fetch_external(entry):
    """Fetch only pinned public publisher URLs, without Zoer credentials."""
    url=entry['url'];require(url in [RECOVERY_URL,RECOVERY_PACKAGE_URL,RECOVERY_DEFINITION_URL],'Unreviewed external source endpoint')
    if url==RECOVERY_URL:
        size=entry['bytes'];step=1000000;ranges=[(a,min(a+step-1,size-1)) for a in range(0,size,step)]
        def part(bounds):
            a,b=bounds
            with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':f'bytes={a}-{b}'}),timeout=90) as response:
                raw=response.read();require(response.url==url and response.status==206 and response.headers.get('Content-Range')==f'bytes {a}-{b}/{size}' and len(raw)==b-a+1,'Official publisher byte-range/length identity changed');return raw
        with ThreadPoolExecutor(max_workers=6) as pool:raw=b''.join(pool.map(part,ranges))
    else:
        with urllib.request.urlopen(url,timeout=90) as response:
            require(response.status==200 and response.url==url,'Official publisher endpoint identity changed');raw=response.read()
    require(hashlib.sha256(raw).hexdigest()==entry['sha256'],'Official publisher source hash drift: '+entry['filename'])
    return raw
def refresh(root,headers):
    manifest=json.loads(fetch(MANIFEST,headers));resources={r['id']:r for r in manifest['resources'] if r.get('kind')=='dataset'};root.mkdir(parents=True,exist_ok=True)
    for c in sorted({s['collectionId'] for s in SOURCES}):
        did=next(s['datasetId'] for s in SOURCES if s['collectionId']==c);require(did in resources and resources[did].get('available'),'Reviewed dataset unavailable');r=resources[did];require(r['datasetUrl']=='/api/datasets/'+did,'Dataset endpoint changed');raw=fetch(HOST+r['datasetUrl'],headers);d=json.loads(raw)['dataset'];require(d['id']==did and d['status']=='ready' and d['artifactVersion']==1,'Dataset identity/version changed');(root/(c+'-metadata.json')).write_bytes(raw)
    cat=next(r for r in manifest['manifestSources'] if r['id']==CATALOGUE);links={f['name']:f['url'] for f in cat['files']};files=csv_rows(fetch(HOST+links['NHHR_files.csv'],headers));tables=csv_rows(fetch(HOST+links['NHHR_tables.csv'],headers))
    for s in SOURCES:
        matches=[r for r in files if r['dataset_id']==s['datasetId'] and r['canonical_relative_path']==s['sourceRelativePath']];require(any(r['sha256']==s['sha256'] and r['original_file_ids'].split(';')==s['originalFileIds'] for r in matches),'Source original ID/hash lock changed')
        for t in s['tables']:
            rr=[r for r in tables if r['dataset_id']==s['datasetId'] and r['table_name']==t['tableName']];require(len(rr)==1 and rr[0]['source_sha256']==s['sha256'] and rr[0]['parquet_sha256']==t['parquetSha256'] and int(rr[0]['row_count'])==t['rows'],'Scientific table lineage changed')
    def download(s):
        raw=b''.join(fetch(HOST+'/api/files/'+ident+'/download',headers) for ident in s['originalFileIds']);require(hashlib.sha256(raw).hexdigest()==s['sha256'],'Downloaded original/multipart hash differs');p=root/s['collectionId']/s['filename'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
    with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(download,SOURCES))
    external_root=root/'EXTERNAL-NSERC-2011';external_root.mkdir(parents=True,exist_ok=True)
    for entry in EXTERNAL_SOURCES:(external_root/entry['filename']).write_bytes(fetch_external(entry))
def emit(path,value,check):
    raw=(json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False)+'\n').encode()
    if check:require(path.exists() and path.read_bytes()==raw,str(path.relative_to(ROOT))+': generated output drift')
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',type=pathlib.Path,required=True);p.add_argument('--refresh',action='store_true');p.add_argument('--check',action='store_true');p.add_argument('--headers-file',type=pathlib.Path);args=p.parse_args()
    if args.refresh:refresh(args.input,json.loads(args.headers_file.read_text()) if args.headers_file else {})
    release,provenance,report=prepare(args.input);emit(ROOT/'src/atlas/snapshots/research-followup.json',release,args.check);emit(ROOT/'public/data/nhhr/research-followup.json',release,args.check);emit(ROOT/'public/data/nhhr/research-followup-provenance.json',provenance,args.check);emit(ROOT/'docs/nhhr-research-followup-review.json',report,args.check);print(json.dumps(release['snapshot']))
if __name__=='__main__':main()
