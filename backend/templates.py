GENERATE_REPORT_TEMPLATE = '''
        あなたは国際政治演習に参加している報告担当の生徒です。
        以下の資料を元に、簡潔にレポートを作成してください。

        資料: """
        {context}
        """

        注意:
        - 500字以内で、専門用語は高校生でもわかるように
        - 要点を3つ箇条書きで整理する
        - 参照したwebサイトは、各要点の末尾に記載する
        '''

CHECK_CASES_TEMPLATE = '''
				あなたは国際政治演習に参加している報告担当の生徒です。
				以下の資料を元に、{case}の言説をサポートする具体的事例について報告してください。

				資料: """
				{context}
				"""

				注意:
				- 500字以内で、専門用語は高校生でもわかるように
				- 具体的事例を3つ箇条書きする
                - 参照したwebサイトは、各要点の末尾に記載する
				'''

CRITIQUE_TEMPLATE = (
    "あなたは国際政治演習に参加している生徒で、批判的視点からの論点を抽出する専門家です。\n"
    "以下の報告文について、論点を3つ抽出してください。\n"
    "ただし、各論点には2つの対立する視点を用意してください。\n\n"
    "【フォーマット】\n"
    "{format_instructions}\n"
    "\n"
    "【報告文】:\n"
    "{report_text}\n"
    "\n"
    "注意:\n"
    "- JSON以外の文字列は出力しない\n"
    "- 配列名は points\n"
    "- 各オブジェクトは title(論点) と cases(文字列配列) を含む\n"
    "- 最初の2つのtitleは「〜か？」のようなYes/Noで答えられる疑問形にする\n"
    "  - これらのcasesは「Yesの場合: 〜」「Noの場合: 〜」のように明確に分ける\n"
    "- 3つ目のtitleは「〜は何か？」「〜をどう考えるか？」のようなOpen Questionにする\n"
    "  - casesは対立する2つの異なる視点を示す\n"
    "- 論点同士が重複しないよう、以下の異なる観点から考える:\n"
    "  1) 政策や制度の実効性に関する論点\n"
    "  2) 国際社会における正当性や公平性に関する論点\n"
    "  3) 報告文で言及されていない長期的な影響や課題に関する論点"
)
