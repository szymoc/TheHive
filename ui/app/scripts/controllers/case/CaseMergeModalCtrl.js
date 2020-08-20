(function () {
    'use strict';

    angular.module('theHiveControllers')
        .controller('CaseMergeModalCtrl', CaseMergeModalCtrl);

    function CaseMergeModalCtrl($state, $uibModalInstance, $q, SearchSrv, CaseSrv, UserInfoSrv, NotificationSrv, source, title, prompt) {
        var me = this;

        this.source = source;
        this.caze = source;
        this.title = title;
        this.prompt = prompt;
        this.search = {
            type: 'title',
            placeholder: 'Search by case title',
            minInputLength: 1,
            input: null,
            cases: []
        };
        this.getUserInfo = UserInfoSrv;

        this.getCaseByTitle = function(type, input) {
            var defer = $q.defer();

            SearchSrv(function (data /*, total*/ ) {
                defer.resolve(data);
            }, (type === 'title') ? {'_string': 'title:"' + input + '"'} : {'caseId': input}, 'case', 'all');

            return defer.promise;
        };

        this.format = function(caze) {
            if(caze) {
                return '#' + caze.caseId  + ' - ' + caze.title;
            }
            return null;
        };

        this.clearSearch = function() {
            this.search.input = null;
            this.search.cases = [];
        };

        this.onTypeChange = function(type) {
            this.clearSearch();

            this.search.placeholder = 'Search by case ' + type;

            if(type === 'title') {
                this.search.minInputLength = 3;
            } else if(type === 'number') {
                this.search.minInputLength = 1;
            }
        };

        this.onSelect = function(item /*, model, label*/) {
            this.search.cases = [item];
        };

        this.merge = function () {
            $uibModalInstance.close(me.search.cases[0]);
        };

        this.cancel = function () {
            $uibModalInstance.dismiss();
        };
    }
})();
