# Sources

What ScrubX's PHI and injection detection and their tests are built on. [Decision 13](decisions/13-find-identifiers-the-detector-was-not-told-about.md), [Decision 14](decisions/14-same-surname-is-not-the-patient.md), [Decision 15](decisions/15-an-override-has-to-aim-at-the-assistant.md) and [Decision 16](decisions/16-a-cue-word-is-not-part-of-the-name.md) say which change each one informed.

1. U.S. Code of Federal Regulations. *45 CFR § 164.514(b)(2), HIPAA Safe Harbor de-identification standard.* https://www.law.cornell.edu/cfr/text/45/164.514
2. Xiao, Y., Lim, S., Pollard, T. J., & Ghassemi, M. (2023). *In the Name of Fairness: Assessing the Bias in Clinical Record De-identification.* FAccT '23. https://doi.org/10.1145/3593013.3593982 · https://arxiv.org/abs/2305.11348
3. Norgeot, B., et al. (2020). *Protected Health Information filter (Philter): accurately and securely de-identifying free-text clinical notes.* npj Digital Medicine, 3, 57. https://pmc.ncbi.nlm.nih.gov/articles/PMC7156708/
4. Stubbs, A., & Uzuner, Ö. (2015). *Annotating longitudinal clinical narratives for de-identification: The 2014 i2b2/UTHealth corpus.* Journal of Biomedical Informatics, 58(Suppl), S20–S29. https://pmc.ncbi.nlm.nih.gov/articles/PMC4978170
5. MDN Web Docs. *Word boundary assertion: `\b`.* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Word_boundary_assertion
6. MDN Web Docs. *Unicode character class escape: `\p{...}`.* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape
7. LangChain. *Multi-language data anonymization with Microsoft Presidio.* https://python.langchain.com/docs/guides/privacy/presidio_data_anonymization/multi_language
8. Vitest. *API reference: `test.fails`.* https://vitest.dev/api/#test-fails
9. Dehghan, A., et al. (2015). *Combining knowledge- and data-driven methods for de-identification of clinical narratives.* Journal of Biomedical Informatics, 58(Suppl). https://doi.org/10.1016/j.jbi.2015.06.029 · https://pmc.ncbi.nlm.nih.gov/articles/PMC4976126/
10. Yang, H., & Garibaldi, J. M. (2015). *Automatic detection of protected health information from clinic narratives.* Journal of Biomedical Informatics, 58(Suppl). https://doi.org/10.1016/j.jbi.2015.06.015 · https://pmc.ncbi.nlm.nih.gov/articles/PMC4989090/
11. Xu, Y., et al. (2012). *A classification approach to coreference in discharge summaries: 2011 i2b2 challenge.* Journal of the American Medical Informatics Association, 19(5), 897–905. https://pmc.ncbi.nlm.nih.gov/articles/PMC3422828/
12. Uzuner, Ö., Luo, Y., & Szolovits, P. (2007). *Evaluating the state-of-the-art in automatic de-identification.* Journal of the American Medical Informatics Association, 14(5). https://doi.org/10.1197/jamia.M2444 · https://pmc.ncbi.nlm.nih.gov/articles/PMC1975792/
13. Stubbs, A., Kotfila, C., & Uzuner, Ö. (2015). *Automated systems for the de-identification of longitudinal clinical narratives: Overview of 2014 i2b2/UTHealth shared task Track 1.* Journal of Biomedical Informatics, 58(Suppl). https://doi.org/10.1016/j.jbi.2015.06.007 · https://pmc.ncbi.nlm.nih.gov/articles/PMC4989908/
14. Neamatullah, I., et al. (2008). *Automated de-identification of free-text medical records.* BMC Medical Informatics and Decision Making, 8, 32. https://pmc.ncbi.nlm.nih.gov/articles/PMC2526997/ · source: https://physionet.org/files/deid/1.1/deid.pl
15. Raghunathan, K., et al. (2010). *A multi-pass sieve for coreference resolution.* EMNLP 2010. https://aclanthology.org/D10-1048.pdf
16. Lee, H., et al. (2013). *Deterministic coreference resolution based on entity-centric, precision-ranked rules.* Computational Linguistics, 39(4). https://aclanthology.org/J13-4004.pdf
17. Sweeney, L. (1996). *Replacing personally-identifying information in medical records, the Scrub system.* Proceedings of the AMIA Annual Fall Symposium, 333–337. https://dataprivacylab.org/projects/scrub/paper1.pdf
18. Perez, F., & Ribeiro, I. (2022). *Ignore Previous Prompt: Attack Techniques For Language Models.* ML Safety Workshop, NeurIPS 2022. https://arxiv.org/abs/2211.09527
19. Liu, Y., Jia, Y., Geng, R., Jia, J., & Gong, N. Z. (2024). *Formalizing and Benchmarking Prompt Injection Attacks and Defenses.* USENIX Security Symposium 2024. https://arxiv.org/abs/2310.12815
20. Li, H., & Liu, X. (2024). *InjecGuard: Benchmarking and Mitigating Over-defense in Prompt Injection Guardrail Models.* arXiv:2410.22770. https://arxiv.org/abs/2410.22770
21. Centers for Medicare & Medicaid Services. *1997 Documentation Guidelines for Evaluation and Management Services.* https://www.cms.gov/outreach-and-education/medicare-learning-network-mln/mlnedwebguide/downloads/97docguidelines.pdf
22. MDN Web Docs. *`RegExp.prototype.exec()`.* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
