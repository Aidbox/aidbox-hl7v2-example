// AUTO-GENERATED - HL7v2 Table Value Types
// Generated for: BAR_P01, ORU_R01, VXU_V04

/** Table 0001 - AdministrativeSex */
export const AdministrativeSex = {
  Female: "F",
  Male: "M",
  Other: "O",
  Unknown: "U",
  Ambiguous: "A",
  NotApplicable: "N",
  NonBinary: "X", // Intended for situations where the gender or sex representati...
} as const;
export type AdministrativeSex = typeof AdministrativeSex[keyof typeof AdministrativeSex];

/** Table 0002 - MaritalStatus */
export const MaritalStatus = {
  Separated: "A",
  Divorced: "D",
  Married: "M",
  Single: "S",
  Widowed: "W",
  CommonLaw: "C",
  LivingTogether: "G",
  DomesticPartner: "P",
  RegisteredDomesticPartner: "R",
  LegallySeparated: "E",
  Annulled: "N",
  Interlocutory: "I",
  Unmarried: "B",
  Unknown: "U",
  Other: "O",
  Unreported: "T",
} as const;
export type MaritalStatus = typeof MaritalStatus[keyof typeof MaritalStatus];

/** Table 0003 - Event */
export const Event = {
  PexProductExperience: "X01",
  AdtAckAdmitVisitNotification: "A01",
  AdtAckTransferAPatient: "A02",
  AdtAckDischargeEndVisit: "A03",
  AdtAckRegisterAPatient: "A04",
  AdtAckPreAdmitAPatient: "A05",
  AdtAckChangeAnOutpatientToAnInpatient: "A06",
  AdtAckChangeAnInpatientToAnOutpatient: "A07",
  AdtAckUpdatePatientInformation: "A08",
  AdtAckPatientDepartingTracking: "A09",
  AdtAckPatientArrivingTracking: "A10",
  AdtAckCancelAdmitVisitNotification: "A11",
  AdtAckCancelTransfer: "A12",
  AdtAckCancelDischargeEndVisit: "A13",
  AdtAckPendingAdmit: "A14",
  AdtAckPendingTransfer: "A15",
  AdtAckPendingDischarge: "A16",
  AdtAckSwapPatients: "A17",
  AdtAckMergePatientInformation: "A18",
  QryAdrPatientQuery: "A19",
  AdtAckBedStatusUpdate: "A20",
  AdtAckPatientGoesOnALeaveOfAbsence: "A21",
  AdtAckPatientReturnsFromALeaveOfAbsence: "A22",
  AdtAckDeleteAPatientRecord: "A23",
  AdtAckLinkPatientInformation: "A24",
  AdtAckCancelPendingDischarge: "A25",
  AdtAckCancelPendingTransfer: "A26",
  AdtAckCancelPendingAdmit: "A27",
  AdtAckAddPersonInformation: "A28",
  AdtAckDeletePersonInformation: "A29",
  AdtAckMergePersonInformation: "A30",
  AdtAckUpdatePersonInformation: "A31",
  AdtAckCancelPatientArrivingTracking: "A32",
  AdtAckCancelPatientDepartingTracking: "A33",
  AdtAckMergePatientInformationPatientIdOnly: "A34",
  AdtAckMergePatientInformationAccountNumberOnly: "A35",
  AdtAckMergePatientInformationPatientIdAndAccountNumber: "A36",
  AdtAckUnlinkPatientInformation: "A37",
  AdtAckCancelPreAdmit: "A38",
  AdtAckMergePersonPatientId: "A39",
  AdtAckMergePatientPatientIdentifierList: "A40",
  AdtAckMergeAccountPatientAccountNumber: "A41",
  AdtAckMergeVisitVisitNumber: "A42",
  AdtAckMovePatientInformationPatientIdentifierList: "A43",
  AdtAckMoveAccountInformationPatientAccountNumber: "A44",
  AdtAckMoveVisitInformationVisitNumber: "A45",
  AdtAckChangePatientId: "A46",
  AdtAckChangePatientIdentifierList: "A47",
  AdtAckChangeAlternatePatientId: "A48",
  AdtAckChangePatientAccountNumber: "A49",
  AdtAckChangeVisitNumber: "A50",
  AdtAckChangeAlternateVisitId: "A51",
  AdtAckCancelLeaveOfAbsenceForAPatient: "A52",
  AdtAckCancelPatientReturnsFromALeaveOfAbsence: "A53",
  AdtAckChangeAttendingDoctor: "A54",
  AdtAckCancelChangeAttendingDoctor: "A55",
  AdtAckUpdateAllergyInformation: "A60",
  AdtAckChangeConsultingDoctor: "A61",
  AdtAckCancelChangeConsultingDoctor: "A62",
  PmuAckAddPersonnelRecord: "B01",
  PmuAckUpdatePersonnelRecord: "B02",
  PmuAckDeletePersonnelReCord: "B03",
  PmuAckActivePracticingPerson: "B04",
  PmuAckDeactivatePracticingPerson: "B05",
  PmuAckTerminatePracticingPerson: "B06",
  PmuAckGrantCertificatePermission: "B07",
  PmuAckRevokeCertificatePermission: "B08",
  CrmRegisterAPatientOnAClinicalTrial: "C01",
  CrmCancelAPatientRegistrationOnClinicalTrialForClericalMistakesOnly: "C02",
  CrmCorrectUpdateRegistrationInformation: "C03",
  CrmPatientHasGoneOffAClinicalTrial: "C04",
  CrmPatientEntersPhaseOfClinicalTrial: "C05",
  CrmCancelPatientEnteringAPhaseClericalMistake: "C06",
  CrmCorrectUpdatePhaseInformation: "C07",
  CrmPatientHasGoneOffPhaseOfClinicalTrial: "C08",
  CsuAutomatedTimeIntervalsForReportingLikeMonthly: "C09",
  CsuPatientCompletesTheClinicalTrial: "C10",
  CsuPatientCompletesAPhaseOfTheClinicalTrial: "C11",
  CsuUpdateCorrectionOfPatientOrderResultInformation: "C12",
  CancelQuery: "CNQ",
  SubmitHealthcareServicesInvoice: "E01",
  CancelHealthcareServicesInvoice: "E02",
  HealthcareServicesInvoiceStatus: "E03",
  MfqMfrMasterFilesQueryUseEventSameAsAskingForEGM05Location: "varies",
  ReAssessHealthcareServicesInvoiceRequest: "E04",
  EditAdjudicationResults: "E10",
  RequestAdditionalInformation: "E12",
  AdditionalInformationResponse: "E13",
  PaymentRemittanceAdvice: "E15",
  SubmitAuthorizationRequest: "E20",
  CancelAuthorizationRequest: "E21",
  AuthorizationRequestStatus: "E22",
  AuthorizationResponse: "E24",
  SubmitHealthDocumentRelatedToAuthorizationRequest: "E30",
  CancelHealthDocumentRelatedToAuthorizationRequest: "E31",
  RqiRpiRequestForInsuranceInformation: "I01",
  RqiRplRequestReceiptOfPatientSelectionDisplayList: "I02",
  RqiRprRequestReceiptOfPatientSelectionList: "I03",
  RqdRpiRequestForPatientDemographicData: "I04",
  RqcRciRequestForPatientClinicalInformation: "I05",
  RqcRclRequestReceiptOfClinicalDataListing: "I06",
  PinAckUnsolicitedInsuranceInformation: "I07",
  RqaRpaRequestForTreatmentAuthorizationInformation: "I08",
  RqaRpaRequestForModificationToAnAuthorization: "I09",
  RqaRpaRequestForResubmissionOfAnAuthorization: "I10",
  RqaRpaRequestForCancellationOfAnAuthorization: "I11",
  RefRriPatientReferral: "I12",
  RefRriModifyPatientReferral: "I13",
  RefRriCancelPatientReferral: "I14",
  RefRriRequestPatientReferralStatus: "I15",
  CollaborativeCareReferral: "I16",
  ModifyCollaborativeCareReferral: "I17",
  CancelCollaborativeCareReferral: "I18",
  CollaborativeCareQueryCollaborativeCareQueryUpdate: "I19",
  AsynchronousCollaborativeCareUpdate: "I20",
  CollaborativeCareMessage: "I21",
  CollaborativeCareFetchCollaborativeCareInformation: "I22",
  QcnAckCancelQueryAcknowledgeMessage: "J01",
  QsxAckCancelSubscriptionAcknowledgeMessage: "J02",
  RspSegmentPatternResponseInResponseToQbpQ11: "K11",
  RtbTabularResponseInResponseToQbpQ13: "K13",
  RdyDisplayResponseInResponseToQbpQ15: "K15",
  RspGetPersonDemographicsResponse: "K21",
  RspFindCandidatesResponse: "K22",
  RspGetCorrespondingIdentifiersResponse: "K23",
  RspAllocateIdentifiersResponse: "K24",
  RspPersonnelInformationBySegmentResponse: "K25",
  RspDispenseHistoryResponse: "K31",
  FindCandidatesIncludingVisitInformationResponse: "K32",
  GetDonorRecordCandidatesResponseMessage: "K33",
  SegmentPatternResponseMessage: "K34",
  MfnMfkMasterFileNotOtherwiseSpecified: "M01",
  MfnMfkMasterFileStaffPractitioner: "M02",
  MfnMfkMasterFileTestObservation: "M03",
  MfnMfkMasterFilesChargeDescription: "M04",
  MfnMfkPatientLocationMasterFile: "M05",
  MfnMfkClinicalStudyWithPhasesAndSchedulesMasterFile: "M06",
  MfnMfkClinicalStudyWithoutPhasesButWithSchedulesMasterFile: "M07",
  MfnMfkTestObservationNumericMasterFile: "M08",
  MfnMfkTestObservationCategoricalMasterFile: "M09",
  MfnMfkTestObservationBatteriesMasterFile: "M10",
  MfnMfkTestCalculatedObservationsMasterFile: "M11",
  MfnMfkMasterFileNotificationMessage: "M12",
  MfnMfkMasterFileNotificationGeneral: "M13",
  MfnMfkMasterFileNotificationSiteDefined: "M14",
  MfnMfkInventoryItemMasterFileNotification: "M15",
  R0rPharmacyPrescriptionOrderQueryResponse: "R0R",
  MfnMfkMasterFileNotificationInventoryItemEnhanced: "M16",
  DrgMasterFileMessage: "M17",
  MfnMfkMasterFileNotificationTestObservationPayer: "M18",
  NmqNmrApplicationManagementQueryMessage: "N01",
  NmdAckApplicationManagementDataMessageUnsolicited: "N02",
  OrmOrderMessageAlsoRdeRdsRgvRas: "O01",
  OrrOrderResponseAlsoRreRrdRrgRra: "O02",
  OmdDietOrder: "O03",
  OrdDietOrderAcknowledgment: "O04",
  OmsStockRequisitionOrder: "O05",
  OrsStockRequisitionAcknowledgment: "O06",
  OmnNonStockRequisitionOrder: "O07",
  OrnNonStockRequisitionAcknowledgment: "O08",
  OmpPharmacyTreatmentOrder: "O09",
  OrpPharmacyTreatmentOrderAcknowledgment: "O10",
  RdePharmacyTreatmentEncodedOrder: "O11",
  RrePharmacyTreatmentEncodedOrderAcknowledgment: "O12",
  RdsPharmacyTreatmentDispense: "O13",
  RrdPharmacyTreatmentDispenseAcknowledgment: "O14",
  RgvPharmacyTreatmentGive: "O15",
  RrgPharmacyTreatmentGiveAcknowledgment: "O16",
  RasPharmacyTreatmentAdministration: "O17",
  RraPharmacyTreatmentAdministrationAcknowledgment: "O18",
  OmgGeneralClinicalOrder: "O19",
  OrgOrlGeneralClinicalOrderResponse: "O20",
  OmlLaboratoryOrder: "O21",
  OrlGeneralLaboratoryOrderResponseMessageToAnyOml: "O22",
  OmiImagingOrder: "O23",
  OriImagingOrderResponseMessageToAnyOmi: "O24",
  RdePharmacyTreatmentRefillAuthorizationRequest: "O25",
  RrePharmacyTreatmentRefillAuthorizationAcknowledgement: "O26",
  OmbBloodProductOrder: "O27",
  OrbBloodProductOrderAcknowledgment: "O28",
  BpsBloodProductDispenseStatus: "O29",
  BrpBloodProductDispenseStatusAcknowledgment: "O30",
  BtsBloodProductTransfusionDisposition: "O31",
  BrtBloodProductTransfusionDispositionAcknowledgment: "O32",
  OmlLaboratoryOrderForMultipleOrdersRelatedToASingleSpecimen: "O33",
  OrlLaboratoryOrderResponseMessageToAMultipleOrderRelatedToSingleSpecimenOml: "O34",
  OmlLaboratoryOrderForMultipleOrdersRelatedToASingleContainerOfASpecimen: "O35",
  QryDsrQueryForDisplayResultsSeeQ01: "R05",
  OrlLaboratoryOrderResponseMessageToASingleContainerOfASpecimenOml: "O36",
  UdmUnsolicitedUpdateDisplayResultsSeeQ05: "R06",
  OplPopulationLocationBasedLaboratoryOrderMessage: "O37",
  OprPopulationLocationBasedLaboratoryOrderAcknowledgmentMessage: "O38",
  SpecimenShipmentCentricLaboratoryOrder: "O39",
  SpecimenShipmentCentricLaboratoryOrderAcknowledgmentMessage: "O40",
  DbcCreateDonorRecordMessage: "O41",
  DbuUpdateDonorRecordMessage: "O42",
  RarPharmacyAdministrationInformationQueryResponse: "RAR",
  GeneralOrderMessageWithDocumentPayloadAcknowledgementMessage: "O43",
  RdrPharmacyDispenseInformationQueryResponse: "RDR",
  EqqEmbeddedQueryLanguageQuery: "Q04",
  DonorRegistrationMinimalMessage: "O44",
  RerPharmacyEncodedOrderInformationQueryResponse: "RER",
  DonorEligibilityObservationsMessage: "O45",
  RgrPharmacyDoseInformationQueryResponse: "RGR",
  DonorEligiblityMessage: "O46",
  VqqVirtualTableQuery: "Q07",
  DonorRequestToCollectMessage: "O47",
  SpqStoredProcedureRequest: "Q08",
  DonationProcedureMessage: "O48",
  RqqEventReplayQuery: "Q09",
  PharmacyTreatmentDispenseRequestMessage: "O49",
  PharmacyTreatmentEncodedOrderAcknowledgment: "O50",
  OsuOrderStatusUpdate: "O51",
  OsuOrderStatusUpdateAcknowledgement: "O52",
  OrlGeneralLaboratoryOrderAcknowledgmentMessagePatientOptional: "O53",
  OrlLaboratoryOrderAcknowledgmentMessageMultipleOrderPerSpecimenPatientOptional: "O54",
  OrlLaboratoryOrderAcknowledgmentMessageMultipleOrderPerContainerOfSpecimenPatientOptional: "O55",
  OrlSpecimenShipmentCentricLaboratoryOrderAcknowledgmentMessagePatientOptional: "O56",
  OmqGeneralOrderMessageWithDocumentPayload: "O57",
  OrxGeneralOrderMessageWithDocumentPayloadAcknowledgementMessage: "O58",
  OmlLaboratoryOrderForAdditionalWorkUp: "O59", // Fulfillment order for work up on a previously communicated r...
  BarAckAddPatientAccounts: "P01",
  BarAckPurgePatientAccounts: "P02",
  DftAckPostDetailFinancialTransaction: "P03",
  QryDspGenerateBillAndARStatements: "P04",
  BarAckUpdateAccount: "P05",
  BarAckEndAccount: "P06",
  PexUnsolicitedInitialIndividualProductExperienceReport: "P07",
  QryDsrDisplayOrientedResultsQueryUnsolUpdateForBackwardCompatibilityOnlyReplacedByQ05: "R03",
  PexUnsolicitedUpdateIndividualProductExperienceReport: "P08",
  SurSummaryProductExperienceReport: "P09",
  BarAckTransmitAmbulatoryPaymentClassificationApc: "P10",
  EdrEnhancedDisplayResponse: "R07",
  DftAckPostDetailFinancialTransactionsNew: "P11",
  TbrTabularDataResponse: "R08",
  BarAckUpdateDiagnosisProcedure: "P12",
  PprPcProblemAdd: "PC1",
  ErpEventReplayResponse: "R09",
  PprPcProblemUpdate: "PC2",
  PprPcProblemDelete: "PC3",
  QryPcProblemQuery: "PC4",
  PrrPcProblemResponse: "PC5",
  PglPcGoalAdd: "PC6",
  PglPcGoalUpdate: "PC7",
  PglPcGoalDelete: "PC8",
  QryPcGoalQuery: "PC9",
  PpvPcGoalResponse: "PCA",
  PppPcPathwayProblemOrientedAdd: "PCB",
  PppPcPathwayProblemOrientedUpdate: "PCC",
  PppPcPathwayProblemOrientedDelete: "PCD",
  QryPcPathwayProblemOrientedQuery: "PCE",
  PtrPcPathwayProblemOrientedQueryResponse: "PCF",
  PpgPcPathwayGoalOrientedAdd: "PCG",
  PpgPcPathwayGoalOrientedUpdate: "PCH",
  PpgPcPathwayGoalOrientedDelete: "PCJ",
  QryPcPathwayGoalOrientedQuery: "PCK",
  PptPcPathwayGoalOrientedQueryResponse: "PCL",
  QryDsrQuerySentForImmediateResponse: "Q01",
  QryQckQuerySentForDeferredResponse: "Q02",
  DsrAckDeferredResponseToAQuery: "Q03",
  UdmAckUnsolicitedDisplayUpdateMessage: "Q05",
  OsqOsrQueryForOrderStatus: "Q06",
  QbpQueryByParameterRequestingAnRspSegmentPatternResponse: "Q11",
  QbpQueryByParameterRequestingAnRtbTabularResponse: "Q13",
  QbpQueryByParameterRequestingAnRdyDisplayResponse: "Q15",
  QsbCreateSubscription: "Q16",
  QvrQueryForPreviousEvents: "Q17",
  QbpGetPersonDemographics: "Q21",
  QbpFindCandidates: "Q22",
  QbpGetCorrespondingIdentifiers: "Q23",
  QbpAllocateIdentifiers: "Q24",
  QbpPersonnelInformationBySegmentQuery: "Q25",
  RorPharmacyTreatmentOrderResponse: "Q26",
  RarPharmacyTreatmentAdministrationInformation: "Q27",
  RdrPharmacyTreatmentDispenseInformation: "Q28",
  RerPharmacyTreatmentEncodedOrderInformation: "Q29",
  RgrPharmacyTreatmentDoseInformation: "Q30",
  QbpQueryDispenseHistory: "Q31",
  FindCandidatesIncludingVisitInformation: "Q32",
  QbpGetDonorRecordCandidates: "Q33",
  QbpGetDonorRecord: "Q34",
  OruAckUnsolicitedTransmissionOfAnObservationMessage: "R01",
  QryQueryForResultsOfObservation: "R02",
  OrfResponseToQueryTransmissionOfRequestedObservation: "R04",
  OulUnsolicitedLaboratoryObservation: "R21",
  OulUnsolicitedSpecimenOrientedObservationMessage: "R22",
  OulUnsolicitedSpecimenContainerOrientedObservationMessage: "R23",
  OulUnsolicitedOrderOrientedObservationMessage: "R24",
  OpuUnsolicitedPopulationLocationBasedLaboratoryObservationMessage: "R25",
  OsmUnsolicitedSpecimenShipmentManifestMessage: "R26",
  OruUnsolicitedPointOfCareObservationMessageWithoutExistingOrderPlaceAnOrder: "R30",
  OruUnsolicitedNewPointOfCareObservationMessageSearchForAnOrder: "R31",
  OruUnsolicitedPreOrderedPointOfCareObservation: "R32",
  OraObservationReportAcknowledgement: "R33",
  OruUnsolicitedReportAlarm: "R40",
  ObservationReportAlertAcknowledgement: "R41",
  OruUnsolicitedDeviceEventObservationMessage: "R42",
  OruUnsolicitedPatientDeviceAssociationObservationMessage: "R43",
  RorPharmacyPrescriptionOrderQueryResponse: "ROR",
  SrmSrrRequestNewAppointmentBooking: "S01",
  SrmSrrRequestAppointmentRescheduling: "S02",
  SrmSrrRequestAppointmentModification: "S03",
  SrmSrrRequestAppointmentCancellation: "S04",
  SrmSrrRequestAppointmentDiscontinuation: "S05",
  SrmSrrRequestAppointmentDeletion: "S06",
  SrmSrrRequestAdditionOfServiceResourceOnAppointment: "S07",
  SrmSrrRequestModificationOfServiceResourceOnAppointment: "S08",
  SrmSrrRequestCancellationOfServiceResourceOnAppointment: "S09",
  SrmSrrRequestDiscontinuationOfServiceResourceOnAppointment: "S10",
  SrmSrrRequestDeletionOfServiceResourceOnAppointment: "S11",
  SiuAckNotificationOfNewAppointmentBooking: "S12",
  SiuAckNotificationOfAppointmentRescheduling: "S13",
  SiuAckNotificationOfAppointmentModification: "S14",
  SiuAckNotificationOfAppointmentCancellation: "S15",
  SiuAckNotificationOfAppointmentDiscontinuation: "S16",
  SiuAckNotificationOfAppointmentDeletion: "S17",
  SiuAckNotificationOfAdditionOfServiceResourceOnAppointment: "S18",
  SiuAckNotificationOfModificationOfServiceResourceOnAppointment: "S19",
  SiuAckNotificationOfCancellationOfServiceResourceOnAppointment: "S20",
  SiuAckNotificationOfDiscontinuationOfServiceResourceOnAppointment: "S21",
  SiuAckNotificationOfDeletionOfServiceResourceOnAppointment: "S22",
  SiuAckNotificationOfBlockedScheduleTimeSlotS: "S23",
  SiuAckNotificationOfOpenedUnblockedScheduleTimeSlotS: "S24",
  SqmSqrScheduleQueryMessageAndResponse: "S25",
  SiuAckNotificationThatPatientDidNotShowUpForScheduleAppointment: "S26",
  SiuAckBroadcastNotificationOfScheduledAppointments: "S27",
  SlrSlsRequestNewSterilizationLot: "S28",
  SlrSlsRequestSterilizationLotDeletion: "S29",
  StiStsRequestItem: "S30",
  SdrSdsRequestAntiMicrobialDeviceData: "S31",
  SmdSmsRequestAntiMicrobialDeviceCycleData: "S32",
  StcAckNotificationOfSterilizationConfiguration: "S33",
  SlnAckNotificationOfSterilizationLot: "S34",
  SlnAckNotificationOfSterilizationLotDeletion: "S35",
  SdnAckNotificationOfAntiMicrobialDeviceData: "S36",
  ScnAckNotificationOfAntiMicrobialDeviceCycleData: "S37",
  ContainersPreparedForSpecimenCollection: "S38", // Describes the event before specimen collection, when contain...
  SpecimenCollectionSuccessful: "S39", // Describes the event when specimen collection was successful
  SpecimenCollectionUnsuccessful: "S40", // Describes the event when specimen collection was not success...
  SpecimenDeparted: "S41", // Describes the event when a specimen has been moved from a lo...
  SpecimenArrived: "S42", // Describes the event when a specimen has been moved to a loca...
  SpecimenAccepted: "S43", // Describes the event when a specimen has been accepted on the...
  SpecimenRejected: "S44", // Describes the event when a specimen has been rejected by the...
  SpecimenReIdentified: "S45", // Describes the event when a specimen has been assigned an ide...
  SpecimenDeIdentified: "S46", // Describes the event when a specimen identifier has been remo...
  SpecimenSentToArchive: "S47", // Describes the event when a specimen has been moved into stor...
  SpecimenRetrievedFromArchive: "S48", // Describes the event when a specimen has been moved out of st...
  SpecimenDisposedOf: "S49", // Describes the event when a specimen has been permanently dis...
  SpecimenProcedureStepSuccessfulWithDerivedSpecimenS: "S50", // Describes the event when one or more specimen(s) has(ve) bee...
  SpecimenProcedureStepSuccessfulNoDerivedSpecimenS: "S51", // Describes the event when a specimen has been successfully pr...
  SpecimenProcedureStepUnsuccessful: "S52", // Describes the event when a specimen could not be successfull...
  MdmAckOriginalDocumentNotification: "T01",
  MdmAckOriginalDocumentNotificationAndContent: "T02",
  MdmAckDocumentStatusChangeNotification: "T03",
  MdmAckDocumentStatusChangeNotificationAndContent: "T04",
  MdmAckDocumentAddendumNotification: "T05",
  MdmAckDocumentAddendumNotificationAndContent: "T06",
  MdmAckDocumentEditNotification: "T07",
  MdmAckDocumentEditNotificationAndContent: "T08",
  MdmAckDocumentReplacementNotification: "T09",
  MdmAckDocumentReplacementNotificationAndContent: "T10",
  MdmAckDocumentCancelNotification: "T11",
  QryDocDocumentQuery: "T12",
  EsuAckAutomatedEquipmentStatusUpdate: "U01",
  EsrAckAutomatedEquipmentStatusRequest: "U02",
  SsuAckSpecimenStatusUpdate: "U03",
  SsrAckSpecimenStatusRequest: "U04",
  InuAckAutomatedEquipmentInventoryUpdate: "U05",
  InrAckAutomatedEquipmentInventoryRequest: "U06",
  EacAckAutomatedEquipmentCommand: "U07",
  EarAckAutomatedEquipmentResponse: "U08",
  EanAckAutomatedEquipmentNotification: "U09",
  TcuAckAutomatedEquipmentTestCodeSettingsUpdate: "U10",
  TcrAckAutomatedEquipmentTestCodeSettingsRequest: "U11",
  LsuAckAutomatedEquipmentLogServiceUpdate: "U12",
  LsrAckAutomatedEquipmentLogServiceRequest: "U13",
  InrAckAutomatedEquipmentInventoryRequest_U14: "U14",
  VxqQueryForVaccinationRecord: "V01",
  VxxResponseToVaccinationQueryReturningMultiplePidMatches: "V02",
  VxrVaccinationRecordResponse: "V03",
  VxuUnsolicitedVaccinationRecordUpdate: "V04",
  MfqMfrMasterFilesQueryUseEventSameAsAskingForEGM05Location_Varies: "Varies",
  OruWaveformResultUnsolicitedTransmissionOfRequestedInformation: "W01",
  QrfWaveformResultResponseToQuery: "W02",
} as const;
export type Event = typeof Event[keyof typeof Event];

/** Table 0004 - PatientClass */
export const PatientClass = {
  Emergency: "E",
  Inpatient: "I",
  Outpatient: "O",
  Preadmit: "P",
  RecurringPatient: "R",
  Obstetrics: "B",
  CommercialAccount: "C",
  NotApplicable: "N",
  Unknown: "U",
} as const;
export type PatientClass = typeof PatientClass[keyof typeof PatientClass];

/** Table 0005 - PHRaceAndEthnicityCDC */
export const PHRaceAndEthnicityCDC = {
  Black: "B",
  Caucasian: "C",
  Hispanic: "H",
  Oriental: "R",
  SeeChapter3: "...",
} as const;
export type PHRaceAndEthnicityCDC = typeof PHRaceAndEthnicityCDC[keyof typeof PHRaceAndEthnicityCDC];

/** Table 0006 - Religion2 */
export const Religion2 = {
  Atheist: "A",
  Baptist: "B",
  Catholic: "C",
  Episcopalian: "E",
  Judaism: "J",
  Lutheran: "L",
  ChurchOfLatterDaySaintsMormon: "M",
  Hindu: "N",
  Protestant: "P",
  Agnostic: "AGN",
  Atheist_ATH: "ATH",
  BahaI: "BAH",
  Brethren: "BRE",
  Buddhist: "BUD",
  BuddhistMahayana: "BMA",
  BuddhistTheravada: "BTH",
  BuddhistTantrayana: "BTA",
  BuddhistOther: "BOT",
  ChineseFolkReligionist: "CFR",
  Christian: "CHR",
  ChristianAmericanBaptistChurch: "ABC",
  ChristianAfricanMethodistEpiscopal: "AMT",
  ChristianAfricanMethodistEpiscopalZion: "AME",
  ChristianAnglican: "ANG",
  ChristianAssemblyOfGod: "AOG",
  ChristianBaptist: "BAP",
  ChristianChristianReformed: "CRR",
  ChristianChristianScience: "CHS",
  ChristianChristianMissionaryAlliance: "CMA",
  ChristianChurchOfChrist: "COC",
  ChristianChurchOfGod: "COG",
  ChristianChurchOfGodInChrist: "COI",
  ChristianCommunity: "COM",
  ChristianCongregational: "COL",
  ChristianEasternOrthodox: "EOT",
  ChristianEvangelicalChurch: "EVC",
  ChristianEpiscopalian: "EPI",
  ChristianFreeWillBaptist: "FWB",
  ChristianFriends: "FRQ",
  ChristianFullGospel: "FUL",
  ChristianGreekOrthodox: "GRE",
  ChristianJehovahSWitness: "JWN",
  ChristianLatterDaySaints: "MOM",
  ChristianLutheran: "LUT",
  ChristianLutheranMissouriSynod: "LMS",
  ChristianMennonite: "MEN",
  ChristianMethodist: "MET",
  ChristianChurchOfTheNazarene: "NAZ",
  ChristianOrthodox: "ORT",
  ChristianPentecostal: "PEN",
  ChristianOtherPentecostal: "COP",
  ChristianPresbyterian: "PRE",
  ChristianProtestant: "PRO",
  ChristianOtherProtestant: "PRC",
  ChristianFriends_QUA: "QUA",
  ChristianReformedChurch: "REC",
  ChristianReorganizedChurchOfJesusChristLds: "REO",
  ChristianRomanCatholic: "CAT",
  ChristianSalvationArmy: "SAA",
  ChristianSeventhDayAdventist: "SEV",
  ChristianSouthernBaptist: "SOU",
  ChristianUnitedChurchOfChrist: "UCC",
  ChristianUnitedMethodist: "UMD",
  ChristianUnitarian: "UNI",
  ChristianUnitarianUniversalist: "UNU",
  ChristianWesleyan: "WES",
  ChristianWesleyanMethodist: "WMC",
  ChristianOther: "COT",
  Confucian: "CNF",
  DisciplesOfChrist: "DOC",
  EthnicReligionist: "ERL",
  Hindu_HIN: "HIN",
  HinduShaivites: "HSH",
  HinduVaishnavites: "HVA",
  HinduOther: "HOT",
  Jain: "JAI",
  Jewish: "JEW",
  JewishConservative: "JCO",
  JewishOrthodox: "JOR",
  JewishReconstructionist: "JRC",
  JewishReform: "JRF",
  JewishRenewal: "JRN",
  JewishOther: "JOT",
  Muslim: "MOS",
  MuslimShiite: "MSH",
  MuslimSunni: "MSU",
  MuslimOther: "MOT",
  NativeAmerican: "NAM",
  NewReligionist: "NRL",
  Nonreligious: "NOE",
  Shintoist: "SHN",
  Sikh: "SIK",
  Spiritist: "SPI",
  Other: "OTH",
  Unknown: "VAR",
} as const;
export type Religion2 = typeof Religion2[keyof typeof Religion2];

/** Table 0007 - AdmissionType */
export const AdmissionType = {
  Accident: "A",
  Emergency: "E",
  LaborAndDelivery: "L",
  Routine: "R",
  NewbornBirthInHealthcareFacility: "N",
  Urgent: "U",
  Elective: "C",
} as const;
export type AdmissionType = typeof AdmissionType[keyof typeof AdmissionType];

/** Table 0009 - AmbulatoryStatus */
export const AmbulatoryStatus = {
  NoFunctionalLimitations: "A0",
  AmbulatesWithAssistiveDevice: "A1",
  WheelchairStretcherBound: "A2",
  ComatoseNonResponsive: "A3",
  Disoriented: "A4",
  VisionImpaired: "A5",
  HearingImpaired: "A6",
  SpeechImpaired: "A7",
  NonEnglishSpeaking: "A8",
  FunctionalLevelUnknown: "A9",
  OxygenTherapy: "B1",
  SpecialEquipmentTubesIvsCatheters: "B2",
  Amputee: "B3",
  Mastectomy: "B4",
  Paraplegic: "B5",
  Pregnant: "B6",
} as const;
export type AmbulatoryStatus = typeof AmbulatoryStatus[keyof typeof AmbulatoryStatus];

/** Table 0017 - TransactionType */
export const TransactionType = {
  Charge: "CG",
  Credit: "CD",
  Payment: "PY",
  Adjustment: "AJ",
  CoPayment: "CO",
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

/** Table 0038 - OrderStatus */
export const OrderStatus = {
  SomeButNotAllResultsAvailable: "A",
  OrderWasCanceled: "CA",
  OrderIsCompleted: "CM",
  OrderWasDiscontinued: "DC",
  ErrorOrderNotFound: "ER",
  OrderIsOnHold: "HD",
  InProcessUnspecified: "IP",
  OrderHasBeenReplaced: "RP",
  InProcessScheduled: "SC",
} as const;
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

/** Table 0052 - DiagnosisType */
export const DiagnosisType = {
  Admitting: "A",
  Working: "W",
  Final: "F",
} as const;
export type DiagnosisType = typeof DiagnosisType[keyof typeof DiagnosisType];

/** Table 0062 - EventReason */
export const EventReason = {
  PatientRequest: "01",
  PhysicianHealthPractitionerOrder: "02",
  CensusManagement: "03",
  Other: "O",
  Unknown: "U",
} as const;
export type EventReason = typeof EventReason[keyof typeof EventReason];

/** Table 0063 - Relationship */
export const Relationship = {
  Self: "SEL",
  Spouse: "SPO",
  LifePartner: "DOM",
  Child: "CHD",
  Grandchild: "GCH",
  NaturalChild: "NCH",
  Stepchild: "SCH",
  FosterChild: "FCH",
  HandicappedDependent: "DEP",
  WardOfCourt: "WRD",
  Parent: "PAR",
  Mother: "MTH",
  Father: "FTH",
  CareGiver: "CGV",
  Guardian: "GRD",
  Grandparent: "GRP",
  ExtendedFamily: "EXF",
  Sibling: "SIB",
  Brother: "BRO",
  Sister: "SIS",
  Friend: "FND",
  OtherAdult: "OAD",
  Employee: "EME",
  Employer: "EMR",
  Associate: "ASC",
  EmergencyContact: "EMC",
  Owner: "OWN",
  Trainer: "TRA",
  Manager: "MGR",
  None: "NON",
  Unknown: "UNK",
  Other: "OTH",
} as const;
export type Relationship = typeof Relationship[keyof typeof Relationship];

/** Table 0065 - SpecimenAction */
export const SpecimenAction = {
  CancelOrderForBatteryOrTestsNamed: "C",
  AddOrderedTestsToTheExistingSpecimen: "A",
  GeneratedOrderReflexOrder: "G",
  LabToObtainSpecimenFromPatient: "L",
  SpecimenObtainedByServiceOtherThanLab: "O",
  PendingSpecimenOrderSentPriorToDelivery: "P",
  RevisedOrder: "R",
  ScheduleTheTestsSpecifiedBelow: "S",
} as const;
export type SpecimenAction = typeof SpecimenAction[keyof typeof SpecimenAction];

/** Table 0066 - EmploymentStatus */
export const EmploymentStatus = {
  FullTimeEmployed: "1",
  FullTime: "F",
  SeeChapter6: "...",
  PartTimeEmployed: "2",
  PartTime: "P",
  SelfEmployed: "4", // Self-employed,
  PerDiem: "D",
  ContractPerDiem: "C",
  LeaveOfAbsenceEGFamilyLeaveSabbaticalEtc: "L",
  TemporarilyUnemployed: "T",
  Unemployed: "3",
  Retired: "5",
  OnActiveMilitaryDuty: "6",
  Other: "O",
  Unknown: "9",
} as const;
export type EmploymentStatus = typeof EmploymentStatus[keyof typeof EmploymentStatus];

/** Table 0069 - HospitalService */
export const HospitalService = {
  MedicalService: "MED",
  SurgicalService: "SUR",
  UrologyService: "URO",
  PulmonaryService: "PUL",
  CardiacService: "CAR",
} as const;
export type HospitalService = typeof HospitalService[keyof typeof HospitalService];

/** Table 0074 - DiagnosticServiceSectionId */
export const DiagnosticServiceSectionId = {
  Audiology: "AU",
  BloodGases: "BG",
  BloodBank: "BLB",
  Cytogenetics: "CG",
  CardiacUltrasound: "CUS",
  CardiacCatheterization: "CTH",
  CatScan: "CT",
  Chemistry: "CH",
  Cytopathology: "CP",
  ElectrocardiacEGEkgEecHolter: "EC",
  ElectroneuroEegEmgEpPsg: "EN",
  Genetics: "GE",
  Hematology: "HM",
  DiagnosticImaging: "IMG",
  BedsideIcuMonitoring: "ICU",
  Immunology: "IMM",
  Laboratory: "LAB",
  Microbiology: "MB",
  Mycobacteriology: "MCB",
  Mycology: "MYC",
  NuclearMedicineScan: "NMS",
  NuclearMagneticResonance: "NMR",
  NursingServiceMeasures: "NRS",
  ObUltrasound: "OUS",
  OccupationalTherapy: "OT",
  Other: "OTH",
  OutsideLab: "OSL",
  Parasitology: "PAR",
  Pharmacy: "PHR",
  PathologyGrossHistopathNotSurgical: "PAT",
  PhysicalTherapy: "PT",
  PhysicianHxDxAdmissionNoteEtc: "PHY",
  PulmonaryFunction: "PF",
  Radiology: "RAD",
  Radiograph: "RX",
  RadiologyUltrasound: "RUS",
  RespiratoryCareTherapy: "RC",
  RadiationTherapy: "RT",
  Serology: "SR",
  SurgicalPathology: "SP",
  Toxicology: "TX",
  VascularUltrasound: "VUS",
  Virology: "VR",
  Urinalysis: "URN",
  Cineradiograph: "XRC",
} as const;
export type DiagnosticServiceSectionId = typeof DiagnosticServiceSectionId[keyof typeof DiagnosticServiceSectionId];

/** Table 0080 - NatureOfAbnormalTesting */
export const NatureOfAbnormalTesting = {
  AnAgeBasedPopulation: "A",
  NoneGenericNormalRange: "N",
  ARaceBasedPopulation: "R",
  ASexBasedPopulation: "S",
  Species: "SP",
  Breed: "B",
  Strain: "ST",
} as const;
export type NatureOfAbnormalTesting = typeof NatureOfAbnormalTesting[keyof typeof NatureOfAbnormalTesting];

/** Table 0083 - OutlierType */
export const OutlierType = {
  OutlierDays: "D",
  OutlierCost: "C",
} as const;
export type OutlierType = typeof OutlierType[keyof typeof OutlierType];

/** Table 0085 - ObservationResultStatusCodesInterpretation */
export const ObservationResultStatusCodesInterpretation = {
  AmendedBasedOnAdjustmentsProvidedByThePlacerPhysicianRegardingPatientDemographicsSuchAsAgeAndOrGenderOrOtherPatientSpecificInformation: "A",
  AppendedReportFinalResultsReviewedAndFurtherInformationProvidedForClarityWithoutChangeToTheOriginalResultValues: "B",
  RecordComingOverIsACorrectionAndThusReplacesAFinalResult: "C",
  DeletesTheObxRecord: "D",
  FinalResults: "F",
  SpecimenInLabResultsPending: "I",
  NotAskedUsedToAffirmativelyDocumentThatTheObservationIdentifiedInTheObxWasNotSoughtWhenTheUniversalServiceIdInObr4ImpliesThatItWouldBeSought: "N",
  OrderDetailDescriptionOnlyNoResult: "O",
  PreliminaryResults: "P",
  ResultsEnteredNotVerified: "R",
  PartialResultsDeprecatedRetainedOnlyForBackwardCompatibilityAsOfV26: "S",
  VerifiedFinalResultsReviewedAndConfirmedToBeCorrectNoChangeToResultValueNormalRangeOrAbnormalFlag: "V",
  ResultsCannotBeObtainedForThisObservation: "X",
  ResultsStatusChangeToFinalWithoutRetransmittingResultsAlreadySentAsPreliminaryEGRadiologyChangesStatusFromPreliminaryToFinal: "U",
  PostOriginalAsWrongEGTransmittedForWrongPatient: "W",
} as const;
export type ObservationResultStatusCodesInterpretation = typeof ObservationResultStatusCodesInterpretation[keyof typeof ObservationResultStatusCodesInterpretation];

/** Table 0092 - ReAdmissionIndicator */
export const ReAdmissionIndicator = {
  ReAdmission: "R",
} as const;
export type ReAdmissionIndicator = typeof ReAdmissionIndicator[keyof typeof ReAdmissionIndicator];

/** Table 0098 - TypeOfAgreement */
export const TypeOfAgreement = {
  Standard: "S",
  Unified: "U",
  Maternity: "M",
} as const;
export type TypeOfAgreement = typeof TypeOfAgreement[keyof typeof TypeOfAgreement];

/** Table 0105 - SourceOfComment */
export const SourceOfComment = {
  AncillaryFillerDepartmentIsSourceOfComment: "L",
  OrdererPlacerIsSourceOfComment: "P",
  OtherSystemIsSourceOfComment: "O",
} as const;
export type SourceOfComment = typeof SourceOfComment[keyof typeof SourceOfComment];

/** Table 0116 - BedStatus */
export const BedStatus = {
  Closed: "C",
  Housekeeping: "H",
  Occupied: "O",
  Unoccupied: "U",
  Contaminated: "K",
  Isolated: "I",
} as const;
export type BedStatus = typeof BedStatus[keyof typeof BedStatus];

/** Table 0119 - OrderControlCodes */
export const OrderControlCodes = {
  OrderServiceRefillRequestApproval: "AF", // AF is a response to RF where the placer authorizing a refill...
  CancelOrderServiceRequest: "CA",
  ChildOrderService: "CH",
  CombinedResult: "CN",
  CancelProcessStep: "CP",
  CanceledAsRequested: "CR",
  DiscontinueOrderServiceRequest: "DC",
  DataErrors: "DE",
  OrderServiceRefillRequestDenied: "DF",
  DiscontinuedAsRequested: "DR",
  OrderServiceRefilledUnsolicited: "FU",
  HoldOrderRequest: "HD",
  OnHoldAsRequested: "HR",
  LinkOrderServiceToPatientCareProblemOrGoal: "LI",
  MiscellaneousChargeNotAssociatedWithAnOrder: "MC",
  NumberAssigned: "NA",
  NotificationReceived: "NR", // Notifies the Filler that the Placer received a cancellation,...
  NewOrderService: "NW",
  OrderServiceCanceled: "OC",
  OrderServiceDiscontinued: "OD",
  OrderServiceReleased: "OE",
  OrderServiceRefilledAsRequested: "OF",
  OrderServiceHeld: "OH",
  OrderServiceAcceptedOk: "OK",
  NotificationOfOrderForOutsideDispense: "OP",
  ReleasedAsRequested: "OR",
  ParentOrderService: "PA",
  PreviousResultsWithNewOrderService: "PR",
  NotificationOfReplacementOrderForOutsideDispense: "PY",
  RecommendationAccepted: "RA", // Identifies that this previously recommended replacement orde...
  RecommendedChange: "RC", // Identifies that this OBR represents a recommended replacemen...
  RecommendationDeclined: "RD", // Identifies that this previously sent recommended replacement...
  ObservationsPerformedServiceToFollow: "RE",
  RefillOrderServiceRequest: "RF",
  ReleasePreviousHold: "RL",
  ReplacementOrder: "RO",
  OrderServiceReplaceRequest: "RP",
  ReplacedAsRequested: "RQ",
  RequestReceived: "RR",
  ReplacedUnsolicited: "RU",
  StatusChanged: "SC",
  SendOrderServiceNumber: "SN",
  SupplementedAsRequested: "SQ", // Supplementation confirmation message indicating that an orde...
  ResponseToSendOrderServiceStatusRequest: "SR",
  SendOrderServiceStatusRequest: "SS",
  SupplementThisOrder: "SU", // Identifies existing orders to be supplemented in Supplementa...
  UnableToAcceptOrderService: "UA",
  UnableToCancel: "UC",
  UnableToDiscontinue: "UD",
  UnableToRefill: "UF",
  UnableToPutOnHold: "UH",
  UnableToReplace: "UM",
  UnlinkOrderServiceFromPatientCareProblemOrGoal: "UN",
  UnableToRelease: "UR",
  UnableToChange: "UX",
  ChangeOrderServiceRequest: "XO",
  ChangedAsRequested: "XR",
  OrderServiceChangedUnsol: "XX",
} as const;
export type OrderControlCodes = typeof OrderControlCodes[keyof typeof OrderControlCodes];

/** Table 0121 - ResponseFlag */
export const ResponseFlag = {
  ReportExceptionsOnly: "E",
  SameAsEAlsoReplacementAndParentChild: "R", // Report exceptions, replacement and parent-child
  SameAsRAlsoOtherAssociatedSegments: "D", // Report exceptions, replacement, parent-child and other assoc...
  SameAsDPlusConfirmationsExplicitly: "F", // Report exceptions, replacement, parent-child, other associat...
  OnlyTheMsaSegmentIsReturned: "N",
} as const;
export type ResponseFlag = typeof ResponseFlag[keyof typeof ResponseFlag];

/** Table 0123 - ResultStatus */
export const ResultStatus = {
  OrderReceivedSpecimenNotYetReceived: "O",
  NoResultsAvailableSpecimenReceivedProcedureIncomplete: "I",
  NoResultsAvailableProcedureScheduledButNotDone: "S",
  SomeButNotAllResultsAvailable: "A",
  Preliminary: "P", // A verified early result is available, final results not yet ...
  CorrectedFinal: "C", // A result under an order, that has been finalized has been co...
  ResultsStoredNotYetVerified: "R",
  FinalResults: "F", // Final results; results stored and verified.
  NoResultsAvailableOrderCanceled: "X", // No results available; Order canceled.
  NoOrderOnRecordForThisTest: "Y", // No order on record for this test.
  NoRecordOfThisPatient: "Z", // No record of this patient.
  CorrectedNotFinal: "M", // A result under an order, that has not yet been finalized has...
  ProcedureCompletedResultsPending: "N", // No result available; requested procedure done.  To indicate ...
} as const;
export type ResultStatus = typeof ResultStatus[keyof typeof ResultStatus];

/** Table 0124 - TransportationMode */
export const TransportationMode = {
  CartPatientTravelsOnCartOrGurney: "CART",
  TheExaminingDeviceGoesToPatientSLocation: "PORT",
  PatientWalksToDiagnosticService: "WALK",
  Wheelchair: "WHLC",
} as const;
export type TransportationMode = typeof TransportationMode[keyof typeof TransportationMode];

/** Table 0127 - AllergenType */
export const AllergenType = {
  DrugAllergy: "DA",
  FoodAllergy: "FA",
  MiscellaneousAllergy: "MA",
  MiscellaneousContraindication: "MC",
  EnvironmentalAllergy: "EA",
  AnimalAllergy: "AA",
  PlantAllergy: "PA",
  PollenAllergy: "LA",
} as const;
export type AllergenType = typeof AllergenType[keyof typeof AllergenType];

/** Table 0128 - AllergySeverity */
export const AllergySeverity = {
  Severe: "SV",
  Moderate: "MO",
  Mild: "MI",
  Unknown: "U",
} as const;
export type AllergySeverity = typeof AllergySeverity[keyof typeof AllergySeverity];

/** Table 0130 - VisitUserCodes */
export const VisitUserCodes = {
  Teaching: "TE",
  Home: "HO",
  MobileUnit: "MO",
  Phone: "PH",
} as const;
export type VisitUserCodes = typeof VisitUserCodes[keyof typeof VisitUserCodes];

/** Table 0131 - ContactRole2 */
export const ContactRole2 = {
  BillingContactPerson: "BP",
  ContactPerson: "CP",
  EmergencyContactPerson: "EP",
  PersonPreparingReferral: "PR",
  Employer: "E",
  EmergencyContact: "C",
  FederalAgency: "F",
  InsuranceCompany: "I",
  NextOfKin: "N",
  StateAgency: "S",
  Other: "O",
  Unknown: "U",
} as const;
export type ContactRole2 = typeof ContactRole2[keyof typeof ContactRole2];

/** Table 0135 - AssignmentOfBenefits */
export const AssignmentOfBenefits = {
  Yes: "Y",
  No: "N",
  ModifiedAssignment: "M",
} as const;
export type AssignmentOfBenefits = typeof AssignmentOfBenefits[keyof typeof AssignmentOfBenefits];

/** Table 0137 - MailClaimParty */
export const MailClaimParty = {
  Employer: "E",
  Guarantor: "G",
  InsuranceCompany: "I",
  Other: "O",
  Patient: "P",
} as const;
export type MailClaimParty = typeof MailClaimParty[keyof typeof MailClaimParty];

/** Table 0140 - MilitaryService */
export const MilitaryService = {
  UsArmy: "USA",
  UsNavy: "USN",
  UsAirForce: "USAF",
  UsMarineCorps: "USMC",
  UsCoastGuard: "USCG",
  UsPublicHealthService: "USPHS",
  NationalOceanicAndAtmosphericAdministration: "NOAA",
  NorthAtlanticTreatyOrganization: "NATO",
  AustralianArmy: "AUSA",
  AustralianNavy: "AUSN",
  AustralianAirForce: "AUSAF",
} as const;
export type MilitaryService = typeof MilitaryService[keyof typeof MilitaryService];

/** Table 0142 - MilitaryStatus */
export const MilitaryStatus = {
  ActiveDuty: "ACT",
  Retired: "RET",
  Deceased: "DEC",
} as const;
export type MilitaryStatus = typeof MilitaryStatus[keyof typeof MilitaryStatus];

/** Table 0144 - EligibilitySource */
export const EligibilitySource = {
  InsuranceCompany: "1",
  Employer: "2",
  InsuredPresentedPolicy: "3",
  InsuredPresentedCard: "4",
  SignedStatementOnFile: "5",
  VerbalInformation: "6",
  None: "7",
} as const;
export type EligibilitySource = typeof EligibilitySource[keyof typeof EligibilitySource];

/** Table 0155 - AcceptApplicationAcknowledgmentConditions */
export const AcceptApplicationAcknowledgmentConditions = {
  Always: "AL",
  Never: "NE",
  ErrorRejectConditionsOnly: "ER",
  SuccessfulCompletionOnly: "SU",
} as const;
export type AcceptApplicationAcknowledgmentConditions = typeof AcceptApplicationAcknowledgmentConditions[keyof typeof AcceptApplicationAcknowledgmentConditions];

/** Table 0162 - RouteOfAdministration */
export const RouteOfAdministration = {
  ApplyExternally: "AP",
  Buccal: "B",
  Dental: "DT",
  Epidural: "EP",
  EndotrachialTube: "ET", // Endotrachial Tube*
  GastrostomyTube: "GTT",
  GuIrrigant: "GU",
  ImmerseSoakBodyPart: "IMR",
  IntraArterial: "IA",
  Intrabursal: "IB",
  Intracardiac: "IC",
  IntracervicalUterus: "ICV",
  Intradermal: "ID",
  Inhalation: "IH",
  IntrahepaticArtery: "IHA",
  Intramuscular: "IM",
  Intranasal: "IN",
  Intraocular: "IO",
  Intraperitoneal: "IP",
  Intrasynovial: "IS",
  Intrathecal: "IT",
  Intrauterine: "IU",
  Intravenous: "IV",
  MouthThroat: "MTH",
  MucousMembrane: "MM",
  Nasal: "NS",
  Nasogastric: "NG",
  NasalProngs: "NP", // Nasal Prongs*
  NasotrachialTube: "NT",
  Ophthalmic: "OP",
  Otic: "OT",
  OtherMiscellaneous: "OTH",
  Perfusion: "PF",
  Oral: "PO",
  Rectal: "PR",
  RebreatherMask: "RM", // Rebreather Mask*
  SoakedDressing: "SD",
  Subcutaneous: "SC",
  Sublingual: "SL",
  Topical: "TP",
  Tracheostomy: "TRA", // Tracheostomy*
  Transdermal: "TD",
  Translingual: "TL",
  Urethral: "UR",
  Vaginal: "VG",
  Ventimask: "VM",
  Wound: "WND",
} as const;
export type RouteOfAdministration = typeof RouteOfAdministration[keyof typeof RouteOfAdministration];

/** Table 0163 - BodySite */
export const BodySite = {
  Nebulized: "LNB",
  LeftVastusLateralis: "LV",
  BilateralEars: "BE",
  BilateralEyes: "OU",
  BilateralNares: "BN",
  Buttock: "BU",
  ChestTube: "CT",
  LeftArm: "LA",
  LeftAnteriorChest: "LAC",
  LeftAntecubitalFossa: "LACF",
  LeftDeltoid: "LD",
  LeftEar: "LE",
  LeftExternalJugular: "LEJ",
  LeftEye: "OS",
  LeftFoot: "LF",
  LeftGluteusMedius: "LG",
  LeftHand: "LH",
  LeftInternalJugular: "LIJ",
  LeftLowerAbdQuadrant: "LLAQ",
  LeftLowerForearm: "LLFA",
  LeftMidForearm: "LMFA",
  LeftNaris: "LN",
  LeftPosteriorChest: "LPC",
  LeftSubclavian: "LSC",
  LeftThigh: "LT",
  LeftUpperArm: "LUA",
  LeftUpperAbdQuadrant: "LUAQ",
  LeftUpperForearm: "LUFA",
  LeftVentragluteal: "LVG",
  LeftVastusLateralis_LVL: "LVL",
  Nebulized_NB: "NB",
  Perianal: "PA",
  Perineal: "PERIN",
  RightArm: "RA",
  RightAnteriorChest: "RAC",
  RightAntecubitalFossa: "RACF",
  RightDeltoid: "RD",
  RightEar: "RE",
  RightExternalJugular: "REJ",
  RightEye: "OD",
  RightFoot: "RF",
  RightGluteusMedius: "RG",
  RightHand: "RH",
  RightInternalJugular: "RIJ",
  RtLowerAbdQuadrant: "RLAQ",
  RightLowerForearm: "RLFA",
  RightMidForearm: "RMFA",
  RightNaris: "RN",
  RightPosteriorChest: "RPC",
  RightSubclavian: "RSC",
  RightThigh: "RT",
  RightUpperArm: "RUA",
  RightUpperAbdQuadrant: "RUAQ",
  RightUpperForearm: "RUFA",
  RightVastusLateralis: "RVL",
  RightVentragluteal: "RVG",
} as const;
export type BodySite = typeof BodySite[keyof typeof BodySite];

/** Table 0164 - AdministrationDevice */
export const AdministrationDevice = {
  Applicator: "AP",
  Buretrol: "BT",
  HeparinLock: "HL",
  Ippb: "IPPB",
  IvPump: "IVP",
  IvSoluset: "IVS",
  MeteredInhaler: "MI",
  Nebulizer: "NEB",
  PcaPump: "PCA",
} as const;
export type AdministrationDevice = typeof AdministrationDevice[keyof typeof AdministrationDevice];

/** Table 0165 - AdministrationMethod */
export const AdministrationMethod = {
  Chew: "CH",
  Dissolve: "DI",
  Dust: "DU",
  Infiltrate: "IF",
  Insert: "IS",
  Irrigate: "IR",
  IvPiggyback: "IVPB",
  IvPush: "IVP",
  Nebulized: "NB",
  Paint: "PT",
  Perfuse: "PF",
  Shampoo: "SH",
  Soak: "SO",
  Wash: "WA",
  Wipe: "WI",
} as const;
export type AdministrationMethod = typeof AdministrationMethod[keyof typeof AdministrationMethod];

/** Table 0173 - CoordinationOfBenefits */
export const CoordinationOfBenefits = {
  Coordination: "CO",
  Independent: "IN",
} as const;
export type CoordinationOfBenefits = typeof CoordinationOfBenefits[keyof typeof CoordinationOfBenefits];

/** Table 0177 - ConfidentialityCodes */
export const ConfidentialityCodes = {
  VeryRestricted: "V",
  Restricted: "R",
  UsualControl: "U",
  Employee: "EMP",
  UnwedMother: "UWM",
  VeryImportantPersonOrCelebrity: "VIP",
  PsychiatricPatient: "PSY",
  AidsPatient: "AID",
  HivPatient: "HIV",
  AlcoholDrugTreatmentPatient: "ETH",
} as const;
export type ConfidentialityCodes = typeof ConfidentialityCodes[keyof typeof ConfidentialityCodes];

/** Table 0185 - PreferredMethodOfContact */
export const PreferredMethodOfContact = {
  BeeperNumber: "B",
  CellularPhoneNumber: "C",
  EMailAddressForBackwardCompatibility: "E",
  FaxNumber: "F",
  HomePhoneNumber: "H",
  OfficePhoneNumber: "O",
} as const;
export type PreferredMethodOfContact = typeof PreferredMethodOfContact[keyof typeof PreferredMethodOfContact];

/** Table 0189 - EthnicGroup */
export const EthnicGroup = {
  HispanicOrLatino: "H",
  NotHispanicOrLatino: "N",
  Unknown: "U",
} as const;
export type EthnicGroup = typeof EthnicGroup[keyof typeof EthnicGroup];

/** Table 0203 - IdentifierType */
export const IdentifierType = {
  AccreditationCertificationIdentifier: "AC", // Identifier that has been assigned by an accreditation or cer...
  AccessionId: "ACSN", // Accession Identifier
  AnimalIdentificationNumberUsOfficial: "AIN", // A numbering system for the official identification of indivi...
  AmericanExpress: "AM",
  AmericanMedicalAssociationNumber: "AMA", // A physician identifier assigned by the AMA.
  AccountNumber: "AN", // Account An identifier that is unique to an account.
  AccountNumberCreditor: "ANC", // A more precise definition of an account number
  AccountNumberDebitor: "AND", // A more precise definition of an account number
  AnonymousIdentifier: "ANON", // An identifier for a living subject whose real identity is pr...
  TemporaryAccountNumber: "ANT", // Temporary version of an Account Number
  AdvancedPracticeRegisteredNurseNumber: "APRN", // An identifier that is unique to an advanced practice registe...
  AncestorSpecimenId: "ASID", // A unique identifier for the ancestor specimen.
  BankAccountNumber: "BA",
  BankCardNumber: "BC", // An identifier that is unique to a person's bank card
  BirthCertificateFileNumber: "BCFN", // The identifier used within the jurisdictional vital records ...
  BirthCertificate: "BCT", // A number associated with a document identifying the event of...
  BirthRegistryNumber: "BR", // An identifier unique within the Assigning Authority that is ...
  BreedRegistryNumber: "BRN",
  PrimaryPhysicianOfficeNumber: "BSNR",
  ConsumerApplicationAccountIdentifier: "CAAI", // An identifier for the consumer (e.g., patient, caregiver) fo...
  CostCenterNumber: "CC",
  ChangeOfNameDocument: "CONM", // A number associated with a document identifying a person's l...
  CountyNumber: "CY",
  CitizenshipCard: "CZ", // A number assigned by a person's country of residence to iden...
  DeathCertificateId: "DC", // The identifier assigned to a death certificate, and printed ...
  DeathCertificateFileNumber: "DCFN", // The identifier used within the jurisdictional vital records ...
  DentistLicenseNumber: "DDS", // An identifier that is unique to a dentist within the jurisdi...
  DrugEnforcementAdministrationRegistrationNumber: "DEA", // An identifier for an individual or organization relative to ...
  DrugFurnishingOrPrescriptiveAuthorityNumber: "DFN", // An identifier issued to a health care provider authorizing t...
  DinerSClubCard: "DI",
  DriverSLicenseNumber: "DL",
  DoctorNumber: "DN",
  OsteopathicLicenseNumber: "DO", // An identifier that is unique to an osteopath within the juri...
  DiplomaticPassport: "DP", // A number assigned to a diplomatic passport.
  PodiatristLicenseNumber: "DPM", // An identifier that is unique to a podiatrist within the juri...
  DonorRegistrationNumber: "DR",
  DiscoverCard: "DS",
  DiagnosticStudyGroup: "DSG", // Unique Identifier that groups several orders that are to be ...
  EmployeeNumber: "EI", // A number that uniquely identifies an employee to an employer...
  EmployerNumber: "EN",
  StaffEnterpriseNumber: "ESN", // An identifier that is unique to a staff member within an ent...
  ElectronicTransmitterIdentificationNumber: "ETIN", // A unique identifier usually assigned by a health plan or cle...
  FetalDeathReportId: "FDR", // The identifier assigned to a fetal death report, and printed...
  FetalDeathReportFileNumber: "FDRFN", // The identifier used within the jurisdictional vital records ...
  FillerGroupNumber: "FGN", // Unique identifier assigned to a group of orders by the fille...
  FacilityId: "FI",
  FillerIdentifier: "FILL", // An identifier for a request where the identifier is issued b...
  GuarantorInternalIdentifier: "GI",
  AnimalGroupIdentifierUsOfficial: "GIN", // Identifier that can be used to unambiguously describe a spec...
  InsuredSIdWithPublicInsurance: "GKV", // Identifier that can be used to unambiguously describe the ID...
  GeneralLedgerNumber: "GL",
  GuarantorExternalIdentifier: "GN",
  HealthCardNumber: "HC",
  IndigenousAboriginal: "IND", // A number assigned to a member of an indigenous or aboriginal...
  AnIriStem: "IRISTEM", // An IRI string that can be prepended to the code to obtain a ...
  JurisdictionalHealthNumber: "JHN",
  DentistOfficeNumber: "KZVA", // Identifier that can be used to unambiguously identify the pr...
  LaboratoryAccessionId: "LACSN", // A laboratory accession id is used in the laboratory domain.
  LifelongPhysicianNumber: "LANR",
  LaborAndIndustriesNumber: "LI",
  LaborAndIndustriesNumber_LI: "L&I", // Labor and industries number.  Note that this was introduced ...
  LicenseNumber: "LN",
  LocalRegistryId: "LR",
  PatientMedicaidNumber: "MA",
  MemberNumber: "MB", // An identifier for the insured of an insurance policy (this i...
  PatientSMedicareNumber: "MC",
  PractitionerMedicaidNumber: "MCD",
  MicrochipNumber: "MCN",
  PractitionerMedicareNumber: "MCR",
  MarriageCertificate: "MCT", // A number associated with a document identifying the event of...
  MedicalLicenseNumber: "MD", // An identifier that is unique to a medical doctor within the ...
  MilitaryIdNumber: "MI", // A number assigned to an individual who has had military duty...
  MedicalRecordNumber: "MR", // An identifier that is unique to a patient within a set of me...
  TemporaryMedicalRecordNumber: "MRT", // Temporary version of a Medical Record Number
  Mastercard: "MS",
  SecondaryPhysicianOfficeNumber: "NBSNR",
  NaturalizationCertificate: "NCT", // A number associated with a document identifying a person's r...
  NationalEmployerIdentifier: "NE",
  NationalHealthPlanIdentifier: "NH",
  NationalUniqueIndividualIdentifier: "NI",
  NationalInsuranceOrganizationIdentifier: "NII",
  NationalInsuranceHeadquartersOrganizationIdentifier: "NIIH",
  NationalInsurancePayorIdentifierPayor: "NIIP",
  NationalPersonIdentifierWhereTheXxxIsTheIsoTable31663CharacterAlphabeticCountryCode: "NNxxx",
  NursePractitionerNumber: "NP", // An identifier that is unique to a nurse practitioner within ...
  NationalProviderIdentifier: "NPI",
  ObservationInstanceIdentifier: "OBI", // Unique and persistent identifier for an observation instance
  OptometristLicenseNumber: "OD", // A number that is unique to an individual optometrist within ...
  PhysicianAssistantNumber: "PA", // An identifier that is unique to a physician assistant within...
  PayerIdentifier: "PAYERID", // A unique identifier, usually assigned by a health plan or cl...
  ParoleCard: "PC", // A number identifying a person on parole.
  PenitentiaryCorrectionalInstitutionNumber: "PCN", // A number assigned to individual who is incarcerated.
  LivingSubjectEnterpriseNumber: "PE", // An identifier that is unique to a living subject within an e...
  PensionNumber: "PEN",
  PlacerGroupNumber: "PGN", // Unique identifier assigned to a group of orders by the place...
  PublicHealthCaseIdentifier: "PHC", // Identifier assigned to a person during a case investigation ...
  PublicHealthEventIdentifier: "PHE", // Identifier assigned to an event of interest to public health
  PublicHealthOfficialId: "PHO", // An identifier for a person working at a public health agency...
  PatientInternalIdentifier: "PI", // A number that is unique to a patient within an Assigning Aut...
  PremisesIdentifierNumberUsOfficial: "PIN", // Identifier that uniquely identifies a geographic location in...
  InsuredSIdWithPrivateInsurance: "PKV", // Identifier that can be used to unambiguously describe the ID...
  PlacerIdentifier: "PLAC", // An identifier for a request where the identifier is issued b...
  PersonNumber: "PN", // A number that is unique to a living subject within an Assign...
  TemporaryLivingSubjectNumber: "PNT", // Temporary version of a Living Subject Number.
  MedicareCmsPerformingProviderIdentificationNumber: "PPIN",
  PassportNumber: "PPN", // A unique number assigned to the document affirming that a pe...
  PermanentResidentCardNumber: "PRC",
  ProviderNumber: "PRN", // A number that is unique to an individual provider, a provide...
  PatientExternalIdentifier: "PT",
  QaNumber: "QA",
  ResourceIdentifier: "RI", // A generalized resource identifier.
  RegisteredNurseNumber: "RN", // An identifier that is unique to a registered nurse within th...
  PharmacistLicenseNumber: "RPH", // An identifier that is unique to a pharmacist within the juri...
  RailroadRetirementNumber: "RR", // An identifier for an individual enrolled with the Railroad R...
  RegionalRegistryId: "RRI",
  RailroadRetirementProvider: "RRP",
  SamnAccessionNumber: "SAMN", // The accession number for the BioSample data repository at th...
  SocialBeneficiaryIdentifier: "SB", // An identifier issued by a governmental organization to a per...
  SpecimenId: "SID", // Identifier for a specimen.
  StateLicense: "SL",
  SubscriberNumber: "SN", // An identifier for a subscriber of an insurance policy which ...
  StateAssignedNdbsCardIdentifier: "SNBSN", // The identifier on a Newborn Screening Dried Bloodspot (NDBS)...
  SerialNumber: "SNO", // An identifier affixed to an item by the manufacturer when it...
  StudyPermit: "SP", // A number associated with a permit identifying a person who i...
  StateRegistryId: "SR",
  SraAccessionNumber: "SRX", // The accession number generated by the Sequence Read Archive ...
  SocialSecurityNumber: "SS",
  ShipmentTrackingNumber: "STN", // Identifier assigned to a package being shipped
  TaxIdNumber: "TAX",
  TreatyNumberCanada: "TN", // A number assigned to a member of an indigenous group in Cana...
  TemporaryPermanentResidentCanada: "TPR", // A number associated with a document identifying a person's t...
  TrainingLicenseNumber: "TRL", // The license number used during training.
  UnspecifiedIdentifier: "U",
  UniversalDeviceIdentifier: "UDI", // An identifier assigned to a device using the Unique Device I...
  UniqueClaimIdentifier: "UCID", // A unique identifier assigned by a payer for a claim received...
  UniqueProductIndependentPayerPersonIdentifier: "UMB", // A unique identifier assigned to an individual by a payer tha...
  MedicareCmsFormerlyHcfaSUniversalPhysicianIdentificationNumbers: "UPIN", // An identifier for a provider within the CMS/Medicare program...
  UniqueSpecimenId: "USID", // A unique identifier for a specimen.
  VisitNumber: "VN",
  VisitorPermit: "VP", // A number associated with a document identifying a person as ...
  Visa: "VS",
  WicIdentifier: "WC",
  WorkersCompNumber: "WCN",
  WorkPermit: "WP", // A number associated with a permit for a person who is grante...
  HealthPlanIdentifier: "XV", // National unique health plan identifier required by the US De...
  OrganizationIdentifier: "XX",
  DentistIdentifier: "ZANR", // Identifier that can be used to unambiguously describe the ID...
} as const;
export type IdentifierType = typeof IdentifierType[keyof typeof IdentifierType];

/** Table 0206 - SegmentAction */
export const SegmentAction = {
  AddInsert: "A",
  Delete: "D",
  UsedInSnapshotMode: "S", // Declares when segment falls under snapshot  mode handling, i...
  Update: "U",
  NoChange: "X",
} as const;
export type SegmentAction = typeof SegmentAction[keyof typeof SegmentAction];

/** Table 0211 - AlternateCharacterSets */
export const AlternateCharacterSets = {
  ASubsetOfIso2020UsedForMostKanjiiTransmissions: "JAS2020",
  Iso2022WithEscapeSequencesForKanjii: "JIS X 0202",
  ThePrintable7BitAsciiCharacterSet: "ASCII",
  ThePrintableCharactersFromTheIso88591CharacterSet: "8859/1",
  ThePrintableCharactersFromTheIso88592CharacterSet: "8859/2",
  ThePrintableCharactersFromTheIso88593CharacterSet: "8859/3",
  ThePrintableCharactersFromTheIso88594CharacterSet: "8859/4",
  ThePrintableCharactersFromTheIso88595CharacterSet: "8859/5",
  ThePrintableCharactersFromTheIso88596CharacterSet: "8859/6",
  ThePrintableCharactersFromTheIso88597CharacterSet: "8859/7",
  ThePrintableCharactersFromTheIso88598CharacterSet: "8859/8",
  ThePrintableCharactersFromTheIso88599CharacterSet: "8859/9",
  ThePrintableCharactersFromTheIso885915Latin15: "8859/15",
  AsciiGraphicCharacterSetConsistingOf94Characters: "ISO IR6",
  CodeForInformationExchangeOneByteJisX02011976: "ISO IR14",
  CodeForTheJapaneseGraphicCharacterSetForInformationInterchangeJisX02081990: "ISO IR87",
  CodeOfTheSupplementaryJapaneseGraphicCharacterSetForInformationInterchangeJisX02121990: "ISO IR159",
  CodeForChineseCharacterSetGb180302000: "GB 18030-2000",
  CodeForKoreanCharacterSetKsX1001: "KS X 1001",
  CodeForTaiwaneseCharacterSetCns116431992: "CNS 11643-1992",
  CodeForTaiwaneseCharacterSetBig5: "BIG-5",
  TheWorldWideCharacterStandardFromIsoIec1064611993: "UNICODE",
  UcsTransformationFormat8BitForm: "UNICODE UTF-8",
  UcsTransformationFormat16BitForm: "UNICODE UTF-16",
  UcsTransformationFormat32BitForm: "UNICODE UTF-32",
} as const;
export type AlternateCharacterSets = typeof AlternateCharacterSets[keyof typeof AlternateCharacterSets];

/** Table 0213 - PurgeStatus */
export const PurgeStatus = {
  MarkedForPurgeUserIsNoLongerAbleToUpdateTheVisit: "P",
  TheVisitIsMarkedForDeletionAndTheUserCannotEnterNewDataAgainstIt: "D",
  TheVisitIsMarkedInactiveAndTheUserCannotEnterNewDataAgainstIt: "I",
} as const;
export type PurgeStatus = typeof PurgeStatus[keyof typeof PurgeStatus];

/** Table 0214 - SpecialProgram */
export const SpecialProgram = {
  ChildHealthAssistance: "CH",
  ElectiveSurgeryProgram: "ES",
  FamilyPlanning: "FP",
  Other: "O",
  Unknown: "U",
} as const;
export type SpecialProgram = typeof SpecialProgram[keyof typeof SpecialProgram];

/** Table 0215 - Publicity */
export const Publicity = {
  FamilyOnly: "F",
  NoPublicity: "N",
  Other: "O",
  Unknown: "U",
} as const;
export type Publicity = typeof Publicity[keyof typeof Publicity];

/** Table 0216 - PatientStatus */
export const PatientStatus = {
  ActiveInpatient: "AI",
  DischargedInpatient: "DI",
} as const;
export type PatientStatus = typeof PatientStatus[keyof typeof PatientStatus];

/** Table 0217 - VisitPriority */
export const VisitPriority = {
  Emergency: "1",
  Urgent: "2",
  Elective: "3",
} as const;
export type VisitPriority = typeof VisitPriority[keyof typeof VisitPriority];

/** Table 0220 - LivingArrangement */
export const LivingArrangement = {
  Alone: "A",
  Family: "F",
  Institution: "I",
  Relative: "R",
  Unknown: "U",
  SpouseOnly: "S",
} as const;
export type LivingArrangement = typeof LivingArrangement[keyof typeof LivingArrangement];

/** Table 0223 - LivingDependency2 */
export const LivingDependency2 = {
  SpouseDependent: "D",
  SpouseDependent_S: "S",
  MedicalSupervisionRequired: "M",
  SmallChildrenDependent: "C",
  WalkUp: "WU",
  Other: "O",
  CommonBath: "CB",
  Unknown: "U",
} as const;
export type LivingDependency2 = typeof LivingDependency2[keyof typeof LivingDependency2];

/** Table 0224 - TransportArranged */
export const TransportArranged = {
  Arranged: "A",
  NotArranged: "N",
  Unknown: "U",
} as const;
export type TransportArranged = typeof TransportArranged[keyof typeof TransportArranged];

/** Table 0225 - EscortRequired */
export const EscortRequired = {
  Required: "R",
  NotRequired: "N",
  Unknown: "U",
} as const;
export type EscortRequired = typeof EscortRequired[keyof typeof EscortRequired];

/** Table 0228 - DiagnosisClassification */
export const DiagnosisClassification = {
  Consultation: "C",
  Diagnosis: "D",
  MedicationAntibiotic: "M",
  Other: "O",
  RadiologicalSchedulingNotUsingIcdaCodes: "R",
  SignAndSymptom: "S",
  TissueDiagnosis: "T",
  InvasiveProcedureNotClassifiedElsewhereIVCatheterEtc: "I",
} as const;
export type DiagnosisClassification = typeof DiagnosisClassification[keyof typeof DiagnosisClassification];

/** Table 0230 - ProcedureFunctionalType */
export const ProcedureFunctionalType = {
  Anesthesia: "A",
  ProcedureForTreatmentTherapeuticIncludingOperations: "P",
  InvasiveProcedureNotClassifiedElsewhereEGIvCatheterEtc: "I",
  DiagnosticProcedure: "D",
} as const;
export type ProcedureFunctionalType = typeof ProcedureFunctionalType[keyof typeof ProcedureFunctionalType];

/** Table 0231 - StudentStatus */
export const StudentStatus = {
  FullTimeStudent: "F",
  PartTimeStudent: "P",
  NotAStudent: "N",
} as const;
export type StudentStatus = typeof StudentStatus[keyof typeof StudentStatus];

/** Table 0232 - InsuranceCompanyContactReason */
export const InsuranceCompanyContactReason = {
  MedicareClaimStatus: "01",
  MedicaidClaimStatus: "02",
  NameAddressChange: "03",
} as const;
export type InsuranceCompanyContactReason = typeof InsuranceCompanyContactReason[keyof typeof InsuranceCompanyContactReason];

/** Table 0287 - ProblemGoalAction */
export const ProblemGoalAction = {
  Add: "AD",
  Correct: "CO",
  Delete: "DE",
  Link: "LI",
  UsedInSnapshotMode: "SP", // Declares when segment falls under snapshot  mode handling, i...
  Unchanged: "UC", // UNCHANGED *
  Unlink: "UN",
  Update: "UP",
} as const;
export type ProblemGoalAction = typeof ProblemGoalAction[keyof typeof ProblemGoalAction];

/** Table 0309 - CoverageType */
export const CoverageType = {
  HospitalInstitutional: "H",
  PhysicianProfessional: "P",
  BothHospitalAndPhysician: "B",
  Pharmacy: "RX",
} as const;
export type CoverageType = typeof CoverageType[keyof typeof CoverageType];

/** Table 0311 - JobStatus */
export const JobStatus = {
  Permanent: "P",
  Temporary: "T",
  Other: "O",
  Unknown: "U",
} as const;
export type JobStatus = typeof JobStatus[keyof typeof JobStatus];

/** Table 0315 - LivingWillCodes */
export const LivingWillCodes = {
  YesPatientHasALivingWill: "Y",
  YesPatientHasALivingWillButItIsNotOnFile: "F",
  NoPatientDoesNotHaveALivingWillAndNoInformationWasProvided: "N",
  NoPatientDoesNotHaveALivingWillButInformationWasProvided: "I",
  Unknown: "U",
} as const;
export type LivingWillCodes = typeof LivingWillCodes[keyof typeof LivingWillCodes];

/** Table 0316 - OrganDonorCodes */
export const OrganDonorCodes = {
  YesPatientIsADocumentedDonorAndDocumentationIsOnFile: "Y",
  YesPatientIsADocumentedDonorButDocumentationIsNotOnFile: "F",
  NoPatientHasNotAgreedToBeADonor: "N",
  NoPatientIsNotADocumentedDonorButInformationWasProvided: "I",
  PatientLeavesOrganDonationDecisionToRelatives: "R",
  PatientLeavesOrganDonationDecisionToASpecificPerson: "P",
  Unknown: "U",
} as const;
export type OrganDonorCodes = typeof OrganDonorCodes[keyof typeof OrganDonorCodes];

/** Table 0322 - CompletionStatus */
export const CompletionStatus = {
  Complete: "CP",
  Refused: "RE",
  NotAdministered: "NA",
  PartiallyAdministered: "PA",
} as const;
export type CompletionStatus = typeof CompletionStatus[keyof typeof CompletionStatus];

/** Table 0323 - ActionCodes */
export const ActionCodes = {
  AddInsert: "A",
  Delete: "D",
  Update: "U",
  NoChange: "X",
} as const;
export type ActionCodes = typeof ActionCodes[keyof typeof ActionCodes];

/** Table 0326 - VisitIndicator */
export const VisitIndicator = {
  AccountLevel: "A", // Account level (default)
  VisitLevel: "V",
} as const;
export type VisitIndicator = typeof VisitIndicator[keyof typeof VisitIndicator];

/** Table 0334 - DisabilityInformationRelationship */
export const DisabilityInformationRelationship = {
  Patient: "PT",
  Guarantor: "GT",
  Insured: "IN",
  AssociatedParty: "AP",
} as const;
export type DisabilityInformationRelationship = typeof DisabilityInformationRelationship[keyof typeof DisabilityInformationRelationship];

/** Table 0335 - RepeatPattern */
export const RepeatPattern = {
  EveryIntegerSeconds: "Q<integer>S",
  EveryIntegerMinutes: "Q<integer>M",
  EveryIntegerHours: "Q<integer>H",
  EveryIntegerDays: "Q<integer>D",
  EveryIntegerWeeks: "Q<integer>W",
  EveryIntegerMonthsLunarCycle: "Q<integer>L",
  RepeatsOnAParticularDayOfTheWeek: "Q<integer>J<day#>",
  TwiceADayAtInstitutionSpecifiedTimes: "BID",
  ThreeTimesADayAtInstitutionSpecifiedTimes: "TID",
  FourTimesADayAtInstitutionSpecifiedTimes: "QID",
  XTimesPerDayAtInstitutionSpecifiedTimesWhereXIsANumeral5OrGreater: "xID",
  InTheMorningAtInstitutionSpecifiedTime: "QAM",
  DuringEachOfThreeEightHourShiftsAtInstitutionSpecifiedTimes: "QSHIFT",
  EveryOtherDay: "QOD",
  EveryDayBeforeTheHourOfSleep: "QHS",
  InTheEveningAtInstitutionSpecifiedTime: "QPM",
  ServiceIsProvidedContinuouslyBetweenStartTimeAndStopTime: "C",
  ForFutureUseWhereSpecIsAnIntervalSpecificationAsDefinedByTheUnixCronSpecification: "U <spec>",
  GivenAsNeeded: "PRN",
  WhereXxxIsSomeFrequencyCode: "PRNxxx",
  OneTimeOnly: "Once",
  TimingCCumMeal: "Meal Related Timings",
  AnteBefore: "A",
  PostAfter: "P",
  Inter: "I",
  CibusMatutinusBreakfast: "M",
  CibusDiurnusLunch: "D",
  CibusVespertinusDinner: "V",
} as const;
export type RepeatPattern = typeof RepeatPattern[keyof typeof RepeatPattern];

/** Table 0339 - AdvancedBeneficiaryNotice */
export const AdvancedBeneficiaryNotice = {
  ServiceIsSubjectToMedicalNecessityProcedures: "1",
  PatientHasBeenInformedOfResponsibilityAndAgreesToPayForService: "2",
  PatientHasBeenInformedOfResponsibilityAndAsksThatThePayerBeBilled: "3",
  AdvancedBeneficiaryNoticeHasNotBeenSigned: "4",
} as const;
export type AdvancedBeneficiaryNotice = typeof AdvancedBeneficiaryNotice[keyof typeof AdvancedBeneficiaryNotice];

/** Table 0344 - PatientsRelationshipToInsured */
export const PatientsRelationshipToInsured = {
  PatientIsInsured: "01",
  Spouse: "02",
  NaturalChildInsuredFinancialResponsibility: "03",
  NaturalChildInsuredDoesNotHaveFinancialResponsibility: "04",
  StepChild: "05",
  FosterChild: "06",
  WardOfTheCourt: "07",
  Employee: "08",
  Unknown: "09",
  HandicappedDependent: "10",
  OrganDonor: "11",
  CadaverDonor: "12",
  Grandchild: "13",
  NieceNephew: "14",
  InjuredPlaintiff: "15",
  SponsoredDependent: "16",
  MinorDependentOfAMinorDependent: "17",
  Parent: "18",
  Grandparent: "19",
} as const;
export type PatientsRelationshipToInsured = typeof PatientsRelationshipToInsured[keyof typeof PatientsRelationshipToInsured];

/** Table 0356 - AlternateCharacterSetHandlingScheme */
export const AlternateCharacterSetHandlingScheme = {
  ThisStandardIsTitledInformationTechnologyCharacterCodeStructureAndExtensionTechnique: "ISO 2022-1994",
  TheCharacterSetSwitchingModeSpecifiedInHl725Section272AndSection2A46XpnExtendedPersonName: "2.3",
  ThisIsTheDefaultIndicatingThatThereIsNoCharacterSetSwitchingOccurringInThisMessage: "<null>",
} as const;
export type AlternateCharacterSetHandlingScheme = typeof AlternateCharacterSetHandlingScheme[keyof typeof AlternateCharacterSetHandlingScheme];

/** Table 0359 - DiagnosisPriority */
export const DiagnosisPriority = {
  NotIncludedInDiagnosisRanking: "0",
  ThePrimaryDiagnosis: "1",
  ForRankedSecondaryDiagnoses: "2 and higher",
  ForRankedSecondaryDiagnoses_2: "2 ...",
  ForSecondaryDiagnosis: "2",
  NoSuggestedValuesDefined: "...",
  ForTertiaryDiagnosis: "3",
  ForQuaternaryDiagnosis: "4",
} as const;
export type DiagnosisPriority = typeof DiagnosisPriority[keyof typeof DiagnosisPriority];

/** Table 0364 - CommentType */
export const CommentType = {
  PatientInstructions: "PI",
  AncillaryInstructions: "AI",
  GeneralInstructions: "GI",
  PrimaryReason: "1R",
  SecondaryReason: "2R",
  GeneralReason: "GR",
  Remark: "RE",
  DuplicateInteractionReason: "DR",
} as const;
export type CommentType = typeof CommentType[keyof typeof CommentType];

/** Table 0369 - SpecimenRole */
export const SpecimenRole = {
  BlindSample: "B", // Used to test the validity of the measurement process, where ...
  Calibrator: "C", // Used for initial setting of calibration of the instrument.
  ElectronicQc: "E", // Used with manufactured reference providing signals that simu...
  FillerOrganizationProficiency: "F", // Specimen used for testing proficiency of the organization pe...
  Group: "G", // Used when solid specimens consist of multiple individual ele...
  HistoricalSpecimen: "H", // This identifies a parent specimen to the specimen that is su...
  Pool: "L", // Used when aliquots of liquid individual specimens are combin...
  OperatorProficiency: "O", // Specimen used for testing Operator Proficiency.
  Patient: "P", // Used for any patient sample.
  ControlSpecimen: "Q", // Used when specimen is the control specimen (either positive ...
  ReplicateOfPatientSampleAsAControl: "R", // Used when a patient sample is re-run as a control for a repe...
  VerifyingCalibrator: "V", // Used for periodic calibration checks.
} as const;
export type SpecimenRole = typeof SpecimenRole[keyof typeof SpecimenRole];

/** Table 0371 - AdditivePreservative */
export const AdditivePreservative = {
  _10Formalin: "F10",
  _32Citrate: "C32",
  _38Citrate: "C38",
  _6nHcl: "HCL6",
  AcdSolutionA: "ACDA",
  AcdSolutionB: "ACDB",
  AceticAcid: "ACET",
  AmiesTransportMedium: "AMIES",
  AmmoniumHeparin: "HEPA",
  BacterialTransportMedium: "BACTM",
  BorateBoricAcid: "BOR",
  BouinSSolution: "BOUIN",
  Buffered10Formalin: "BF10",
  BufferedCitrateWestergrenSedimentationRate: "WEST",
  BufferedSkimMilk: "BSKM",
  CarsonSModified10Formalin: "CARS",
  CaryBlairMedium: "CARY",
  ChlamydiaTransportMedium: "CHLTM",
  CtadThisShouldBeSpelledOutIfNotUniversallyUnderstood: "CTAD",
  EntericBacteriaTransportMedium: "ENT",
  EntericPlus: "ENT+",
  JonesKendrickMedium: "JKM",
  KarnovskySFixative: "KARN",
  LithiumIodoacetate: "LIA",
  LithiumLiHeparin: "HEPL",
  M4: "M4",
  M4Rt: "M4RT",
  M5: "M5",
  MichelSTransportMedium: "MICHTM",
  MmdTransportMedium: "MMDTM",
  NitricAcid: "HNO3",
  None: "NONE",
  PagesSSaline: "PAGE",
  Phenol: "PHENOL",
  PotassiumOxalate: "KOX",
  PotassiumKEdta: "EDTK",
  PotassiumKEdta15: "EDTK15",
  PotassiumKEdta75: "EDTK75",
  PvaPolyvinylalcohol: "PVA",
  ReaganLoweMedium: "RLM",
  SerumSeparatorTubePolymerGel: "SST",
  SiliceousEarth12Mg: "SILICA",
  SodiumFluoride: "NAF",
  SodiumFluoride100mg: "FL100",
  SodiumFluoride10mg: "FL10",
  SodiumPolyanetholSulfonate035In085SodiumChloride: "NAPS",
  SodiumNaHeparin: "HEPN",
  SodiumNaEdta: "EDTN",
  SpsThisShouldBeSpelledOutIfNotUniversallyUnderstood: "SPS",
  StuartTransportMedium: "STUTM",
  Thrombin: "THROM",
  ThrombinNihSoybeanTrypsinInhibitorFibrinDegradationProducts: "FDP",
  Thymol: "THYMOL",
  ThyoglycollateBroth: "THYO",
  Toluene: "TOLU",
  UreaplasmaTransportMedium: "URETM",
  ViralTransportMedium: "VIRTM",
} as const;
export type AdditivePreservative = typeof AdditivePreservative[keyof typeof AdditivePreservative];

/** Table 0376 - SpecialHandling */
export const SpecialHandling = {
  BodyTemperature: "C37",
  AmbientTemperature: "AMB",
  CriticalAmbientTemperature: "CAMB",
  RefrigeratedTemperature: "REF",
  CriticalRefrigeratedTemperature: "CREF",
  FrozenTemperature: "FRZ",
  CriticalFrozenTemperature: "CFRZ",
  DeepFrozen: "DFRZ",
  UltraFrozen: "UFRZ",
  LiquidNitrogen: "NTR",
  ProtectFromLight: "PRTL",
  ProtectFromAir: "CATM",
  Dry: "DRY",
  NoShock: "PSO",
  DoNotShake: "PSA",
  Upright: "UPR",
  MetalFree: "MTLF",
} as const;
export type SpecialHandling = typeof SpecialHandling[keyof typeof SpecialHandling];

/** Table 0398 - ContinuationStyle */
export const ContinuationStyle = {
  Fragmentation: "F",
  InteractiveContinuation: "I",
} as const;
export type ContinuationStyle = typeof ContinuationStyle[keyof typeof ContinuationStyle];

/** Table 0406 - OrganizationUnitType */
export const OrganizationUnitType = {
  Home: "H",
  Office: "O",
  Hospital: "1",
  PhysicianClinic: "2",
  LongTermCare: "3",
  AcuteCare: "4",
  Other: "5",
} as const;
export type OrganizationUnitType = typeof OrganizationUnitType[keyof typeof OrganizationUnitType];

/** Table 0415 - DrgTransferType */
export const DrgTransferType = {
  DrgNonExempt: "N",
  DrgExempt: "E",
} as const;
export type DrgTransferType = typeof DrgTransferType[keyof typeof DrgTransferType];

/** Table 0416 - ProcedureDrgType */
export const ProcedureDrgType = {
  _1stNonOperative: "1",
  _2ndNonOperative: "2",
  MajorOperative: "3",
  _2ndOperative: "4",
  _3rdOperative: "5",
} as const;
export type ProcedureDrgType = typeof ProcedureDrgType[keyof typeof ProcedureDrgType];

/** Table 0417 - TissueType */
export const TissueType = {
  InsufficientTissue: "1",
  NotAbnormal: "2",
  AbnormalNotCategorized: "3",
  MechanicalAbnormal: "4",
  GrowthAlteration: "5",
  DegenerationNecrosis: "6",
  NonAcuteInflammation: "7",
  NonMalignantNeoplasm: "8",
  MalignantNeoplasm: "9",
  NoTissueExpected: "0",
  BasalCellCarcinoma: "B",
  CarcinomaUnspecifiedType: "C",
  AdditionalTissueRequired: "G",
} as const;
export type TissueType = typeof TissueType[keyof typeof TissueType];

/** Table 0418 - ProcedurePriority */
export const ProcedurePriority = {
  TheAdmittingProcedure: "0",
  ThePrimaryProcedure: "1",
  ForRankedSecondaryProcedures: "2",
  _Empty: "…",
  NoSuggestedValuesDefined: "...",
} as const;
export type ProcedurePriority = typeof ProcedurePriority[keyof typeof ProcedurePriority];

/** Table 0427 - RiskManagementIncident */
export const RiskManagementIncident = {
  BodyFluidExposure: "B",
  ContaminatedSubstance: "C",
  DietErrors: "D",
  EquipmentProblem: "E",
  PatientFellNotFromBed: "F",
  PatientFellFromBed: "H",
  InfusionError: "I",
  ForeignObjectLeftDuringSurgery: "J",
  SterilePrecautionViolated: "K",
  ProcedureError: "P",
  PharmaceuticalError: "R",
  SuicideAttempt: "S",
  TransfusionError: "T",
  Other: "O",
} as const;
export type RiskManagementIncident = typeof RiskManagementIncident[keyof typeof RiskManagementIncident];

/** Table 0429 - ProductionClass */
export const ProductionClass = {
  BreedingGeneticStock: "BR",
  Dairy: "DA",
  Draft: "DR",
  DualPurpose: "DU",
  LayerIncludesMultiplierFlocks: "LY",
  Meat: "MT",
  Other: "OT",
  Pleasure: "PL",
  Racing: "RA",
  Show: "SH",
  NotApplicable: "NA",
  Unknown: "U",
} as const;
export type ProductionClass = typeof ProductionClass[keyof typeof ProductionClass];

/** Table 0430 - ArrivalMode */
export const ArrivalMode = {
  Ambulance: "A",
  Car: "C",
  OnFoot: "F",
  Helicopter: "H",
  PublicTransport: "P",
  Other: "O",
  Unknown: "U",
} as const;
export type ArrivalMode = typeof ArrivalMode[keyof typeof ArrivalMode];

/** Table 0431 - RecreationalDrugType */
export const RecreationalDrugType = {
  Alcohol: "A",
  Kava: "K",
  Marijuana: "M",
  TobaccoSmoked: "T",
  TobaccoChewed: "C",
  Other: "O",
  Unknown: "U",
} as const;
export type RecreationalDrugType = typeof RecreationalDrugType[keyof typeof RecreationalDrugType];

/** Table 0432 - AdmissionLevelOfCare */
export const AdmissionLevelOfCare = {
  Acute: "AC",
  Chronic: "CH",
  Comatose: "CO",
  Critical: "CR",
  Improved: "IM",
  Moribund: "MO",
} as const;
export type AdmissionLevelOfCare = typeof AdmissionLevelOfCare[keyof typeof AdmissionLevelOfCare];

/** Table 0433 - Precaution */
export const Precaution = {
  Aggressive: "A",
  Blind: "B",
  Confused: "C",
  Deaf: "D",
  OnIv: "I",
  DoNotResuscitate: "N", // "No-code" (i.e. Do not resuscitate)
  Paraplegic: "P",
  Other: "O",
  Unknown: "U",
} as const;
export type Precaution = typeof Precaution[keyof typeof Precaution];

/** Table 0434 - PatientCondition */
export const PatientCondition = {
  Satisfactory: "A",
  Critical: "C",
  Poor: "P",
  Stable: "S",
  Other: "O",
  Unknown: "U",
} as const;
export type PatientCondition = typeof PatientCondition[keyof typeof PatientCondition];

/** Table 0435 - AdvanceDirective */
export const AdvanceDirective = {
  DoNotResuscitate: "DNR",
  NoDirective: "N",
} as const;
export type AdvanceDirective = typeof AdvanceDirective[keyof typeof AdvanceDirective];

/** Table 0441 - ImmunizationRegistryStatus */
export const ImmunizationRegistryStatus = {
  Active: "A",
  Inactive: "I",
  InactiveLostToFollowUpCancelContract: "L",
  InactiveMovedOrGoneElsewhereCancelContract: "M",
  InactivePermanentlyInactiveDoNotReactivateOrAddNewEntriesToTheRecord: "P",
  Other: "O",
  Unknown: "U",
} as const;
export type ImmunizationRegistryStatus = typeof ImmunizationRegistryStatus[keyof typeof ImmunizationRegistryStatus];

/** Table 0443 - ProviderRole */
export const ProviderRole = {
  Admitting: "AD",
  AdministeringProvider: "AP",
  Attending: "AT",
  CollectingProvider: "CLP",
  ConsultingProvider: "CP",
  DispensingProvider: "DP",
  EnteringProviderProbablyNotTheSameAsTranscriptionist: "EP",
  FamilyHealthCareProfessional: "FHCP",
  InitiatingProviderAsInActionBy: "IP",
  MedicalDirector: "MDIR",
  OrderingProvider: "OP",
  PharmacistNotSureHowToDissectPharmacistTreatmentSupplierSVerifierId: "PH",
  PrimaryCareProvider: "PP",
  ResponsibleObserver: "RO",
  ReferringProvider: "RP",
  ReferredToProvider: "RT",
  Transcriptionist: "TR",
  PrimaryInterpreter: "PI",
  AssistantAlternateInterpreter: "AI",
  Technician: "TN",
  VerifyingProvider: "VP",
  VerifyingPharmaceuticalSupplierNotSureHowToDissectPharmacistTreatmentSupplierSVerifierId: "VPS",
  VerifyingTreatmentSupplierNotSureHowToDissectPharmacistTreatmentSupplierSVerifierId: "VTS",
} as const;
export type ProviderRole = typeof ProviderRole[keyof typeof ProviderRole];

/** Table 0445 - IdentityReliability */
export const IdentityReliability = {
  UnknownDefaultSocialSecurityNumber: "US",
  UnknownDefaultDateOfBirth: "UD",
  UnknownDefaultAddress: "UA",
  PatientPersonNameIsAnAlias: "AL",
} as const;
export type IdentityReliability = typeof IdentityReliability[keyof typeof IdentityReliability];

/** Table 0480 - PharmacyOrderTypes */
export const PharmacyOrderTypes = {
  Medication: "M",
  IvLargeVolumeSolutions: "S",
  OtherSolutionAsMedicationOrders: "O",
} as const;
export type PharmacyOrderTypes = typeof PharmacyOrderTypes[keyof typeof PharmacyOrderTypes];

/** Table 0482 - OrderType */
export const OrderType = {
  InpatientOrder: "I",
  OutpatientOrder: "O",
} as const;
export type OrderType = typeof OrderType[keyof typeof OrderType];

/** Table 0483 - AuthorizationMode */
export const AuthorizationMode = {
  Electronic: "EL",
  EMail: "EM",
  Fax: "FX",
  InPerson: "IP",
  Mail: "MA",
  Paper: "PA",
  Phone: "PH",
  ReflexiveAutomatedSystem: "RE",
  VideoConference: "VC",
  Voice: "VO",
} as const;
export type AuthorizationMode = typeof AuthorizationMode[keyof typeof AuthorizationMode];

/** Table 0485 - ExtendedPriorityCodes */
export const ExtendedPriorityCodes = {
  Stat: "S",
  Asap: "A",
  Routine: "R",
  Preop: "P",
  Callback: "C",
  TimingCritical: "T",
  TimingCriticalWithinIntegerSeconds: "TS<integer>",
  TimingCriticalWithinIntegerMinutes: "TM<integer>",
  TimingCriticalWithinIntegerHours: "TH<integer>",
  TimingCriticalWithinIntegerDays: "TD<integer>",
  TimingCriticalWithinIntegerWeeks: "TW<integer>",
  TimingCriticalWithinIntegerMonths: "TL<integer>",
  AsNeeded: "PRN",
} as const;
export type ExtendedPriorityCodes = typeof ExtendedPriorityCodes[keyof typeof ExtendedPriorityCodes];

/** Table 0487 - SpecimenType */
export const SpecimenType = {
  Abscess: "ABS",
  NoSuggestedValues: "...",
  TissueAcne: "ACNE",
  FluidAcne: "ACNFLD",
  AirSample: "AIRS",
  Allograft: "ALL",
  AmnioticFluid: "AMN",
  Amputation: "AMP",
  CatheterTipAngio: "ANGI",
  CatheterTipArterial: "ARTC",
  SerumAcute: "ASERU",
  Aspirate: "ASP",
  EnvironmentAttest: "ATTE",
  EnvironmentalAutoclaveAmpule: "AUTOA",
  EnvironmentalAutoclaveCapsule: "AUTOC",
  Autopsy: "AUTP",
  BloodBag: "BBL",
  CystBakerS: "BCYST",
  WholeBody: "BDY",
  BileFluid: "BIFL",
  Bite: "BITE",
  WholeBlood: "BLD",
  BloodArterial: "BLDA",
  CordBlood: "BLDCO",
  BloodVenous: "BLDV",
  Bleb: "BLEB",
  Blister: "BLIST",
  Boil: "BOIL",
  Bone: "BON",
  BowelContents: "BOWL",
  Basophils: "BPH",
  BloodProductUnit: "BPU",
  Burn: "BRN",
  Brush: "BRSH",
  BreathUseExhld: "BRTH",
  Brushing: "BRUS",
  Bubo: "BUB",
  BullaBullae: "BULLA",
  Biopsy: "BX",
  CalculusStone: "CALC",
  Bone_BONE: "BONE",
  Carbuncle: "CARBU",
  Catheter: "CAT",
  BiteCat: "CBITE",
  CardiacMuscle: "CDM",
  Clippings: "CLIPP",
  Conjunctiva: "CNJT",
  Cannula: "CNL",
  Colostrum: "COL",
  BiospyCone: "CONE",
  ScratchCat: "CSCR",
  SerumConvalescent: "CSERU",
  CerebralSpinalFluid: "CSF",
  CatheterInsertionSite: "CSITE",
  FluidCystostomyTube: "CSMY",
  FluidCyst: "CST",
  BloodCellSaver: "CSVR",
  CatheterTip: "CTP",
  Curretage: "CUR",
  CervicalMucus: "CVM",
  SiteCvp: "CVPS",
  CatheterTipCvp: "CVPT",
  NoduleCystic: "CYN",
  Cyst: "CYST",
  BiteDog: "DBITE",
  SputumDeepCough: "DCS",
  UlcerDecubitus: "DEC",
  EnvironmentalWaterDeionized: "DEION",
  Dialysate: "DIA",
  DialysisFluid: "DIAF",
  Discharge: "DISCHG",
  Diverticulum: "DIV",
  Drain: "DRN",
  DrainageTube: "DRNG",
  DrainagePenrose: "DRNGP",
  DuodenalFluid: "DUFL",
  EarWaxCerumen: "EARW",
  BrushEsophageal: "EBRUSH",
  EnvironmentalEyeWash: "EEYE",
  EnvironmentalEffluent: "EFF",
  Effusion: "EFFUS",
  EnvironmentalFood: "EFOD",
  EnvironmentalIsolette: "EISO",
  Electrode: "ELT",
  EnvironmentalUnidentifiedSubstance: "ENVIR",
  Eosinophils: "EOS",
  EnvironmentalOtherSubstance: "EOTH",
  EnvironmentalSoil: "ESOI",
  EnvironmentalSolutionSterile: "ESOS",
  AspirateEndotrach: "ETA",
  CatheterTipEndotracheal: "ETTP",
  TubeEndotracheal: "ETTUB",
  EnvironmentalWhirlpool: "EWHI",
  GasExhaledBreath: "EXG",
  ShuntExternal: "EXS",
  Exudate: "EXUDTE",
  EnvironmentalWaterWell: "FAW",
  BloodFetal: "FBLOOD",
  FluidAbdomen: "FGA",
  Fibroblasts: "FIB",
  Fistula: "FIST",
  FluidOther: "FLD",
  Filter: "FLT",
  FluidBodyUnsp: "FLU",
  Fluid: "FLUID",
  CatheterTipFoley: "FOLEY",
  FluidRespiratory: "FRS",
  ScalpFetal: "FSCLP",
  Furuncle: "FUR",
  Gas: "GAS",
  AspirateGastric: "GASA",
  AntrumGastric: "GASAN",
  BrushingGastric: "GASBR",
  DrainageGastric: "GASD",
  FluidContentsGastric: "GAST",
  GenitalLochia: "GENL",
  GenitalVaginal: "GENV",
  Graft: "GRAFT",
  GraftSite: "GRAFTS",
  Granuloma: "GRANU",
  CatheterGroshong: "GROSH",
  SolutionGastrostomy: "GSOL",
  BiopsyGastric: "GSPEC",
  TubeGastric: "GT",
  DrainageTubeDrainageGastrostomy: "GTUBE",
  Hair: "HAR",
  BiteHuman: "HBITE",
  BloodAutopsy: "HBLUD",
  CatheterTipHemaquit: "HEMAQ",
  CatheterTipHemovac: "HEMO",
  TissueHerniated: "HERNI",
  DrainHemovac: "HEV",
  CatheterHickman: "HIC",
  FluidHydrocele: "HYDC",
  BiteInsect: "IBITE",
  CystInclusion: "ICYST",
  CatheterTipIndwelling: "IDC",
  GasInhaled: "IHG",
  DrainageIleostomy: "ILEO",
  SourceOfSpecimenIsIllegible: "ILLEG",
  Implant: "IMP",
  SiteIncisionSurgical: "INCI",
  Infiltrate: "INFIL",
  Insect: "INS",
  CatheterTipIntroducer: "INTRD",
  Isolate: "ISLT",
  IntubationTube: "IT",
  IntrauterineDevice: "IUD",
  CatheterTipIv: "IVCAT",
  FluidIv: "IVFLD",
  TubingTipIv: "IVTIP",
  DrainageJejunal: "JEJU",
  FluidJoint: "JNTFLD",
  DrainageJacksonPratt: "JP",
  Lavage: "KELOI",
  FluidKidney: "KIDFLD",
  LavageBronhial: "LAVG",
  LavageGastric: "LAVGG",
  LavagePeritoneal: "LAVGP",
  LavagePreBronch: "LAVPG",
  ContactLens: "LENS1",
  ContactLensCase: "LENS2",
  Lesion: "LESN",
  LiquidUnspecified: "LIQ",
  LiquidOther: "LIQO",
  LineArterial: "LNA",
  LineVenous: "LNV",
  FluidLumbarSac: "LSAC",
  Lymphocytes: "LYM",
  Macrophages: "MAC",
  CatheterTipMakurkour: "MAHUR",
  Marrow: "MAR",
  Mass: "MASS",
  BloodMenstrual: "MBLD",
  Meconium: "MEC",
  BreastMilk: "MILK",
  Milk: "MLK",
  Mucosa: "MUCOS",
  Mucus: "MUCUS",
  Nail: "NAIL",
  DrainageNasal: "NASDR",
  Needle: "NEDL",
  SiteNephrostomy: "NEPH",
  AspirateNasogastric: "NGASP",
  DrainageNasogastric: "NGAST",
  SiteNasoGastric: "NGS",
  NoduleS: "NODUL",
  SecretionNasal: "NSECR",
  Other: "ORH",
  LesionOral: "ORL",
  SourceOther: "OTH",
  Pacemaker: "PACEM",
  PancreaticFluid: "PAFL",
  FluidPericardial: "PCFL",
  SitePeritonealDialysis: "PDSIT",
  SitePeritonealDialysisTunnel: "PDTS",
  AbscessPelvic: "PELVA",
  LesionPenile: "PENIL",
  AbscessPerianal: "PERIA",
  CystPilonidal: "PILOC",
  SitePin: "PINS",
  SitePacemakerInsetion: "PIS",
  PlantMaterial: "PLAN",
  Plasma: "PLAS",
  PlasmaBag: "PLB",
  Placenta: "PLC",
  SerumPeakLevel: "PLEVS",
  PleuralFluidThoracentesisFluid: "PLR",
  PolymorphonuclearNeutrophils: "PMN",
  DrainagePenile: "PND",
  Polyps: "POL",
  GraftSitePopliteal: "POPGS",
  GraftPopliteal: "POPLG",
  SitePoplitealVein: "POPLV",
  CatheterPorta: "PORTA",
  PlasmaPlateletPoor: "PPP",
  ProstheticDevice: "PROST",
  PlasmaPlateletRich: "PRP",
  Pseudocyst: "PSC",
  WoundPuncture: "PUNCT",
  Pus: "PUS",
  Pustule: "PUSFR",
  Pus_PUST: "PUST",
  QualityControl: "QC3",
  UrineRandom: "RANDU",
  Erythrocytes: "RBC",
  BiteReptile: "RBITE",
  DrainageRectal: "RECT",
  AbscessRectal: "RECTA",
  CystRenal: "RENALC",
  FluidRenalCyst: "RENC",
  Respiratory: "RES",
  Saliva: "SAL",
  TissueKeloidScar: "SCAR",
  CatheterTipSubclavian: "SCLV",
  AbscessScrotal: "SCROA",
  SecretionS: "SECRE",
  Serum: "SER",
  SiteShunt: "SHU",
  FluidShunt: "SHUNF",
  Shunt: "SHUNT",
  Site: "SITE",
  BiopsySkin: "SKBP",
  Skin: "SKN",
  MassSubMandibular: "SMM",
  SeminalFluid: "SMN",
  FluidSynovialJointFluid: "SNV",
  Spermatozoa: "SPRM",
  CatheterTipSuprapubic: "SPRP",
  CathetherTipSuprapubic: "SPRPB",
  EnvironmentalSporeStrip: "SPS",
  Sputum: "SPT",
  SputumCoughed: "SPTC",
  SputumTrachealAspirate: "SPTT",
  SputumSimulated: "SPUT1",
  SputumInducted: "SPUTIN",
  SputumSpontaneous: "SPUTSP",
  EnvironmentalSterrad: "STER",
  StoolFecal: "STL",
  StoneKidney: "STONE",
  AbscessSubmandibular: "SUBMA",
  AbscessSubmaxillary: "SUBMX",
  DrainageSump: "SUMP",
  SuprapubicTap: "SUP",
  Suture: "SUTUR",
  CatheterTipSwanGantz: "SWGZ",
  Sweat: "SWT",
  AspirateTracheal: "TASP",
  Tears: "TEAR",
  ThrombocytePlatelet: "THRB",
  Tissue: "TISS",
  TissueUlcer: "TISU",
  CathetherTipTripleLumen: "TLC",
  SiteTracheostomy: "TRAC",
  Transudate: "TRANS",
  SerumTrough: "TSERU",
  AbscessTesticular: "TSTES",
  AspirateTranstracheal: "TTRA",
  Tubes: "TUBES",
  Tumor: "TUMOR",
  SmearTzanck: "TZANC",
  SourceUnidentified: "UDENT",
  UnknownMedicine: "UMED",
  Urine: "UR",
  UrineCleanCatch: "URC",
  UrineBladderWashings: "URINB",
  UrineCatheterized: "URINC",
  UrineMidstream: "URINM",
  UrineNephrostomy: "URINN",
  UrinePedibag: "URINP",
  UrineSediment: "URNS",
  UrineCatheter: "URT",
  UrineCystoscopy: "USCOP",
  SourceUnspecified: "USPEC",
  UnkownSubstance: "USUB",
  CatheterTipVas: "VASTIP",
  CatheterTipVentricular: "VENT",
  VitreousFluid: "VITF",
  Vomitus: "VOM",
  Wash: "WASH",
  WashingEGBronchialWashing: "WASI",
  Water: "WAT",
  BloodWhole: "WB",
  Leukocytes: "WBC",
  Wen: "WEN",
  Wick: "WICK",
  Wound: "WND",
  WoundAbscess: "WNDA",
  WoundDrainage: "WNDD",
  WoundExudate: "WNDE",
  Worm: "WORM",
  Wart: "WRT",
  EnvironmentalWater: "WWA",
  EnvironmentalWaterOcean: "WWO",
  EnvironmentalWaterTap: "WWT",
} as const;
export type SpecimenType = typeof SpecimenType[keyof typeof SpecimenType];

/** Table 0488 - SpecimenCollectionMethod */
export const SpecimenCollectionMethod = {
  AspirationFineNeedle: "FNA",
  ArterialPuncture: "PNA",
  Biopsy: "BIO",
  BloodCultureAerobicBottle: "BCAE",
  BloodCultureAnaerobicBottle: "BCAN",
  BloodCulturePediatricBottle: "BCPD",
  CapillarySpecimen: "CAP",
  Catheterized: "CATH",
  EnvironmentalPlate: "EPLA",
  EnvironmentalSwab: "ESWA",
  LineArterial: "LNA",
  LineCvp: "CVP",
  LineVenous: "LNV",
  MartinLewisAgar: "MARTL",
  ModMartinLewisAgar: "ML11",
  PaceGenProbe: "PACE",
  PinwormPrep: "PIN",
  PlateCough: "KOFFP",
  PlateMartinLewis: "MLP",
  PlateNewYorkCity: "NYP",
  PlateThayerMartin: "TMP",
  PlatesAnaerobic: "ANP",
  PlatesBloodAgar: "BAP",
  PumpPrime: "PRIME",
  PumpSpecimen: "PUMP",
  QualityControlForMicro: "QC5",
  ScalpFetalVein: "SCLP",
  Scrapings: "SCRAPS",
  Shaving: "SHA",
  Swab: "SWA",
  SwabDacronTipped: "SWD",
  SwabWoodenShaft: "WOOD",
  TransportMedia: "TMOT",
  TransportMediaAnaerobic: "TMAN",
  TransportMediaChalamydia: "TMCH",
  TransportMediaM4: "TMM4",
  TransportMediaMycoplasma: "TMMY",
  TransportMediaPva: "TMPV",
  TransportMediaStoolCulture: "TMSC",
  TransportMediaUreaplasma: "TMUP",
  TransportMediaViral: "TMVI",
  Venipuncture: "VENIP",
} as const;
export type SpecimenCollectionMethod = typeof SpecimenCollectionMethod[keyof typeof SpecimenCollectionMethod];

/** Table 0489 - Risks */
export const Risks = {
  Biological: "BIO",
  Corrosive: "COR",
  EscapeRisk: "ESC",
  Aggressive: "AGG",
  Materialdangerinflammable: "IFL",
  Explosive: "EXP",
  Materialdangerinfectious: "INF",
  Biohazard: "BHZ",
  InjuryHazard: "INJ",
  Poison: "POI",
  Radioactive: "RAD",
} as const;
export type Risks = typeof Risks[keyof typeof Risks];

/** Table 0490 - SpecimenRejectReason */
export const SpecimenRejectReason = {
  Expired: "EX",
  QuantityNotSufficient: "QS",
  BrokenContainer: "RB",
  Clotting: "RC",
  MissingCollectionDate: "RD",
  MissingPatientIdNumber: "RA",
  MissingPatientName: "RE",
  Hemolysis: "RH",
  IdentificationProblem: "RI",
  Labeling: "RM",
  Contamination: "RN",
  MissingPhlebotomistId: "RP",
  ImproperStorage: "RR",
  NameMisspelling: "RS",
} as const;
export type SpecimenRejectReason = typeof SpecimenRejectReason[keyof typeof SpecimenRejectReason];

/** Table 0491 - SpecimenQuality */
export const SpecimenQuality = {
  Excellent: "E",
  Good: "G",
  Fair: "F",
  Poor: "P",
} as const;
export type SpecimenQuality = typeof SpecimenQuality[keyof typeof SpecimenQuality];

/** Table 0492 - SpecimenAppropriateness */
export const SpecimenAppropriateness = {
  Preferred: "P",
  Appropriate: "A",
  Inappropriate: "I",
  InappropriateDueTo: "??",
} as const;
export type SpecimenAppropriateness = typeof SpecimenAppropriateness[keyof typeof SpecimenAppropriateness];

/** Table 0493 - SpecimenCondition */
export const SpecimenCondition = {
  Autolyzed: "AUT",
  Clotted: "CLOT",
  Contaminated: "CON",
  Cool: "COOL",
  Frozen: "FROZ",
  Hemolyzed: "HEM",
  Live: "LIVE",
  RoomTemperature: "ROOM",
  SampleNotReceived: "SNR",
  Centrifuged: "CFU",
} as const;
export type SpecimenCondition = typeof SpecimenCondition[keyof typeof SpecimenCondition];

/** Table 0494 - SpecimenChildRole */
export const SpecimenChildRole = {
  Aliquot: "A",
  Component: "C",
  ModifiedFromOriginalSpecimen: "M",
} as const;
export type SpecimenChildRole = typeof SpecimenChildRole[keyof typeof SpecimenChildRole];

/** Table 0495 - BodySiteModifier */
export const BodySiteModifier = {
  Anterior: "ANT",
  Bilateral: "BIL",
  Distal: "DIS",
  External: "EXT",
  Lateral: "LAT",
  Left: "L",
  Lower: "LOW",
  Medial: "MED",
  Posterior: "POS",
  Proximal: "PRO",
  QuadrantLeftLower: "LLQ",
  QuadrantLeftUpper: "LUQ",
  QuadrantRightLower: "RLQ",
  QuadrantRightUpper: "RUQ",
  Right: "R",
  Upper: "UPP",
} as const;
export type BodySiteModifier = typeof BodySiteModifier[keyof typeof BodySiteModifier];

/** Table 0503 - SequenceResultsFlag */
export const SequenceResultsFlag = {
  Sequential: "S",
  Cyclical: "C",
  ReservedForFutureUse: "R",
} as const;
export type SequenceResultsFlag = typeof SequenceResultsFlag[keyof typeof SequenceResultsFlag];

/** Table 0504 - SequenceCondition */
export const SequenceCondition = {
  EndRelatedServiceRequestSEndCurrentServiceRequest: "EE",
  EndRelatedServiceRequestSStartCurrentServiceRequest: "ES",
  StartRelatedServiceRequestSStartCurrentServiceRequest: "SS",
  StartRelatedServiceRequestSEndCurrentServiceRequest: "SE",
} as const;
export type SequenceCondition = typeof SequenceCondition[keyof typeof SequenceCondition];

/** Table 0505 - CyclicEntryExitIndicator */
export const CyclicEntryExitIndicator = {
  FirstService: "F", // The first service request in a cyclic group
  LastService: "L", // The last service request in a cyclic group
  TheFirstServiceRequestInACyclicGroup: "*",
  TheLastServiceRequestInACyclicGroup: "#",
} as const;
export type CyclicEntryExitIndicator = typeof CyclicEntryExitIndicator[keyof typeof CyclicEntryExitIndicator];

/** Table 0506 - ServiceRequestRelationship */
export const ServiceRequestRelationship = {
  NursePrerogative: "N",
  Compound: "C",
  Tapering: "T",
  Exclusive: "E",
  Simultaneous: "S",
} as const;
export type ServiceRequestRelationship = typeof ServiceRequestRelationship[keyof typeof ServiceRequestRelationship];

/** Table 0507 - ObservationResultHandling */
export const ObservationResultHandling = {
  FilmWithPatient: "F",
  NotifyProviderWhenReady: "N",
  AlertProviderWhenAbnormal: "A",
  CopiesRequested: "CC",
  BlindCopy: "BCC",
} as const;
export type ObservationResultHandling = typeof ObservationResultHandling[keyof typeof ObservationResultHandling];

/** Table 0534 - ClergyNotificationType */
export const ClergyNotificationType = {
  Yes: "Y",
  No: "N",
  LastRitesOnly: "L",
  Other: "O",
  Unknown: "U",
} as const;
export type ClergyNotificationType = typeof ClergyNotificationType[keyof typeof ClergyNotificationType];

/** Table 0535 - SignatureType */
export const SignatureType = {
  SignedCms1500ClaimFormOnFileEGAuthorizationForReleaseOfAnyMedicalOrOtherInformationNecessaryToProcessThisClaimAndAssignmentOfBenefits: "C",
  SignedAuthorizationForReleaseOfAnyMedicalOrOtherInformationNecessaryToProcessThisClaimOnFile: "S",
  SignedAuthorizationForAssignmentOfBenefitsOnFile: "M",
  SignatureGeneratedByProviderBecauseThePatientWasNotPhysicallyPresentForServices: "P",
} as const;
export type SignatureType = typeof SignatureType[keyof typeof SignatureType];

/** Table 0544 - ContainerCondition */
export const ContainerCondition = {
  NoSuggestedValues: "...",
  NotBodyTemperature: "XC37",
  NotAmbientTemperature: "XAMB",
  NotCriticalAmbientTemperature: "XCAMB",
  NotRefrigeratedTemperature: "XREF",
  NotCriticalRefrigeratedTemperature: "XCREF",
  NotFrozenTemperature: "XFRZ",
  NotCriticalFrozenTemperature: "XCFRZ",
  NotDeepFrozen: "XDFRZ",
  NotUltraFrozen: "XUFRZ",
  NotLiquidNitrogen: "XNTR",
  NotProtectedFromLight: "XPRTL",
  ExposedToAir: "XCATM",
  NotDry: "XDRY",
  ExposedToShock: "XPSO",
  Shaken: "XPSA",
  NotUpright: "XUPR",
  MetalExposed: "XMTLF",
  SealBroken: "SB",
  ContainerCracked: "CC",
  ContainerTorn: "CT",
  ContainerLeaking: "CL",
} as const;
export type ContainerCondition = typeof ContainerCondition[keyof typeof ContainerCondition];
