(function() {
    'use strict';
    angular.module('theHiveControllers')
        .controller('AlertListCtrl', function($rootScope, $scope, $q, $state, $uibModal, TagSrv, CaseTemplateSrv, ModalUtilsSrv, AlertingSrv, NotificationSrv, FilteringSrv, CortexSrv, Severity, VersionSrv) {
            var self = this;

            self.urls = VersionSrv.mispUrls();

            self.isAdmin = $scope.isAdmin($scope.currentUser);

            self.list = [];
            self.selection = [];
            self.menu = {
                follow: false,
                unfollow: false,
                markAsRead: false,
                markAsUnRead: false,
                delete: false,
                selectAll: false
            };
            self.filtering = new FilteringSrv('alert-section', {
                defaults: {
                    showFilters: false,
                    showStats: false,
                    pageSize: 15,
                    sort: ['-date']
                },
                defaultFilter: {
                    status: {
                        field: 'status',
                        label: 'Status',
                        value: [{
                            text: 'New'
                        }, {
                            text: 'Updated'
                        }],
                        filter: '(status:"New" OR status:"Updated")'
                    }
                },
                filterDefs: {
                    keyword: {
                        field: 'keyword',
                        type: 'string',
                        defaultValue: []
                    },
                    status: {
                        field: 'status',
                        type: 'list',
                        defaultValue: [],
                        label: 'Status'
                    },
                    tags: {
                        field: 'tags',
                        type: 'list',
                        defaultValue: [],
                        label: 'Tags'
                    },
                    source: {
                        field: 'source',
                        type: 'list',
                        defaultValue: [],
                        label: 'Source'
                    },
                    type: {
                        field: 'type',
                        type: 'list',
                        defaultValue: [],
                        label: 'Type'
                    },
                    severity: {
                        field: 'severity',
                        type: 'list',
                        defaultValue: [],
                        label: 'Severity',
                        convert: function(value) {
                            // Convert the text value to its numeric representation
                            return Severity.keys[value];
                        }
                    },
                    title: {
                        field: 'title',
                        type: 'string',
                        defaultValue: '',
                        label: 'Title'
                    },
                    sourceRef: {
                        field: 'sourceRef',
                        type: 'string',
                        defaultValue: '',
                        label: 'Reference'
                    },
                    date: {
                        field: 'date',
                        type: 'date',
                        defaultValue: {
                            from: null,
                            to: null
                        },
                        label: 'Date'
                    }
                }
            });
            self.filtering.initContext('list');
            self.searchForm = {
                searchQuery: self.filtering.buildQuery() || ''
            };
            self.lastSearch = null;
            self.responders = null;

            $scope.$watch('$vm.list.pageSize', function (newValue) {
                self.filtering.setPageSize(newValue);
            });

            this.toggleStats = function () {
                this.filtering.toggleStats();
            };

            this.toggleFilters = function () {
                this.filtering.toggleFilters();
            };

            this.canMarkAsRead = AlertingSrv.canMarkAsRead;
            this.canMarkAsUnread = AlertingSrv.canMarkAsUnread;

            this.markAsRead = function(event) {
                var fn = angular.noop;

                if(this.canMarkAsRead(event)) {
                    fn = AlertingSrv.markAsRead;
                } else {
                    fn = AlertingSrv.markAsUnread;
                }

                fn(event.id).then(function( /*data*/ ) {
                }, function(response) {
                    NotificationSrv.error('AlertListCtrl', response.data, response.status);
                });
            };

            self.follow = function(event) {
                var fn = angular.noop;

                if (event.follow === true) {
                    fn = AlertingSrv.unfollow;
                } else {
                    fn = AlertingSrv.follow;
                }

                fn(event.id).then(function( /*data*/ ) {
                }, function(response) {
                    NotificationSrv.error('AlertListCtrl', response.data, response.status);
                });
            };

            self.bulkFollow = function(follow) {
                var ids = _.pluck(self.selection, 'id');
                var fn = angular.noop;

                if (follow === true) {
                    fn = AlertingSrv.follow;
                } else {
                    fn = AlertingSrv.unfollow;
                }

                var promises = _.map(ids, function(id) {
                    return fn(id);
                });

                $q.all(promises).then(function( /*response*/ ) {
                    NotificationSrv.log('The selected events have been ' + (follow ? 'followed' : 'unfollowed'), 'success');
                }, function(response) {
                    NotificationSrv.error('AlertListCtrl', response.data, response.status);
                });
            };

            self.bulkMarkAsRead = function(markAsReadFlag) {
                var ids = _.pluck(self.selection, 'id');
                var fn = angular.noop;
                var markAsRead = markAsReadFlag && this.canMarkAsRead(self.selection[0]);

                if(markAsRead) {
                    fn = AlertingSrv.markAsRead;
                } else {
                    fn = AlertingSrv.markAsUnread;
                }

                var promises = _.map(ids, function(id) {
                    return fn(id);
                });

                $q.all(promises).then(function( /*response*/ ) {
                    self.list.update();
                    NotificationSrv.log('The selected events have been ' + (markAsRead ? 'marked as read' : 'marked as unread'), 'success');
                }, function(response) {
                    NotificationSrv.error('AlertListCtrl', response.data, response.status);
                });
            };

            self.bulkDelete = function() {

              ModalUtilsSrv.confirm('Remove Alerts', 'Are you sure you want to delete the selected Alerts?', {
                  okText: 'Yes, remove them',
                  flavor: 'danger'
              }).then(function() {
                  var ids = _.pluck(self.selection, 'id');

                  AlertingSrv.bulkRemove(ids)
                      .then(function(/*response*/) {
                          NotificationSrv.log('The selected events have been deleted', 'success');
                      })
                      .catch(function(response) {
                          NotificationSrv.error('AlertListCtrl', response.data, response.status);
                      });
              });
            };

            self.import = function(event) {
                $uibModal.open({
                    templateUrl: 'views/partials/alert/event.dialog.html',
                    controller: 'AlertEventCtrl',
                    controllerAs: 'dialog',
                    size: 'max',
                    resolve: {
                        event: event,
                        templates: function() {
                            return CaseTemplateSrv.list();
                        },
                        isAdmin: self.isAdmin,
                        readonly: false
                    }
                });
            };

            self.resetSelection = function() {
                if (self.menu.selectAll) {
                    self.selectAll();
                } else {
                    self.selection = [];
                    self.menu.selectAll = false;
                    self.updateMenu();
                }
            };

            this.getResponders = function(eventId, force) {
                if(!force && this.responders !== null) {
                   return;
                }

                this.responders = null;
                CortexSrv.getResponders('alert', eventId)
                  .then(function(responders) {
                      self.responders = responders;
                  })
                  .catch(function(err) {
                      NotificationSrv.error('AlertList', err.data, err.status);
                  });
            };

            this.runResponder = function(responderId, responderName, event) {
                CortexSrv.runResponder(responderId, responderName, 'alert', _.pick(event, 'id', 'tlp'))
                  .then(function(response) {
                      NotificationSrv.log(['Responder', response.data.responderName, 'started successfully on alert', event.title].join(' '), 'success');
                  })
                  .catch(function(response) {
                      if(response && !_.isString(response)) {
                          NotificationSrv.error('CaseList', response.data, response.status);
                      }
                  });
            };

            self.load = function() {
                var config = {
                    scope: $scope,
                    filter: self.searchForm.searchQuery !== '' ? {
                        _string: self.searchForm.searchQuery
                    } : '',
                    loadAll: false,
                    sort: self.filtering.context.sort,
                    pageSize: self.filtering.context.pageSize,
                };

                self.list = AlertingSrv.list(config, self.resetSelection);
            };

            self.cancel = function() {
                self.modalInstance.close();
            };

            self.updateMenu = function() {
                var temp = _.uniq(_.pluck(self.selection, 'follow'));

                self.menu.unfollow = temp.length === 1 && temp[0] === true;
                self.menu.follow = temp.length === 1 && temp[0] === false;


                temp = _.uniq(_.pluck(self.selection, 'status'));

                self.menu.markAsRead = temp.indexOf('Ignored') === -1 && temp.indexOf('Imported') === -1;
                self.menu.markAsUnread = temp.indexOf('New') === -1 && temp.indexOf('Updated') === -1;

                self.menu.createNewCase = temp.indexOf('Imported') === -1;
                self.menu.mergeInCase = temp.indexOf('Imported') === -1;

                temp = _.without(_.uniq(_.pluck(self.selection, 'case')), null, undefined);

                self.menu.delete = temp.length === 0;
            };

            self.select = function(event) {
                if (event.selected) {
                    self.selection.push(event);
                } else {
                    self.selection = _.reject(self.selection, function(item) {
                        return item.id === event.id;
                    });
                }

                self.updateMenu();

            };

            self.selectAll = function() {
                var selected = self.menu.selectAll;
                _.each(self.list.values, function(item) {
                    item.selected = selected;
                });

                if (selected) {
                    self.selection = self.list.values;
                } else {
                    self.selection = [];
                }

                self.updateMenu();

            };

            self.createNewCase = function() {
                var alertIds = _.pluck(self.selection, 'id');

                CaseTemplateSrv.list()
                  .then(function(templates) {

                      if(!templates || templates.length === 0) {
                          return $q.resolve(undefined);
                      }

                      // Open template selection dialog
                      var modal = $uibModal.open({
                          templateUrl: 'views/partials/case/case.templates.selector.html',
                          controller: 'CaseTemplatesDialogCtrl',
                          controllerAs: 'dialog',
                          size: 'lg',
                          resolve: {
                              templates: function(){
                                  return templates;
                              },
                              uiSettings: ['UiSettingsSrv', function(UiSettingsSrv) {
                                  return UiSettingsSrv.all();
                              }]
                          }
                      });

                      return modal.result;
                  })
                  .then(function(template) {

                      // Open case creation dialog
                      var modal = $uibModal.open({
                          templateUrl: 'views/partials/case/case.creation.html',
                          controller: 'CaseCreationCtrl',
                          size: 'lg',
                          resolve: {
                              template: template
                          }
                      });

                      return modal.result;
                  })
                  .then(function(createdCase) {
                      // Bulk merge the selected alerts into the created case
                      NotificationSrv.log('New case has been created', 'success');

                      return AlertingSrv.bulkMergeInto(alertIds, createdCase.id);
                  })
                  .then(function(response) {
                      if(alertIds.length === 1) {
                          NotificationSrv.log(alertIds.length + ' Alert has been merged into the newly created case.', 'success');
                      } else {
                          NotificationSrv.log(alertIds.length + ' Alert(s) have been merged into the newly created case.', 'success');
                      }

                      $rootScope.$broadcast('alert:event-imported');

                      $state.go('app.case.details', {
                          caseId: response.data.id
                      });
                  })
                  .catch(function(err) {
                      if(err && !_.isString(err)) {
                          NotificationSrv.error('AlertEventCtrl', err.data, err.status);
                      }
                  });

            };

            self.mergeInCase = function() {
                var caseModal = $uibModal.open({
                    templateUrl: 'views/partials/case/case.merge.html',
                    controller: 'CaseMergeModalCtrl',
                    controllerAs: 'dialog',
                    size: 'lg',
                    resolve: {
                        source: function() {
                            return self.event;
                        },
                        title: function() {
                            return 'Merge selected Alert(s)';
                        },
                        prompt: function() {
                            return 'the ' + self.selection.length + ' selected Alert(s)';
                        }
                    }
                });

                caseModal.result.then(function(selectedCase) {
                    return AlertingSrv.bulkMergeInto(_.pluck(self.selection, 'id'), selectedCase.id);
                })
                .then(function(response) {
                    $rootScope.$broadcast('alert:event-imported');

                    $state.go('app.case.details', {
                        caseId: response.data.id
                    });
                })
                .catch(function(err) {
                    if(err && !_.isString(err)) {
                        NotificationSrv.error('AlertEventCtrl', err.data, err.status);
                    }
                });
            };

            this.filter = function () {
                self.filtering.filter().then(this.applyFilters);
            };

            this.applyFilters = function () {
                self.searchForm.searchQuery = self.filtering.buildQuery();

                if(self.lastSearch !== self.searchForm.searchQuery) {
                    self.lastSearch = self.searchForm.searchQuery;
                    self.search();
                }
            };

            this.clearFilters = function () {
                self.filtering.clearFilters().then(this.applyFilters);
            };

            this.addFilter = function (field, value) {
                self.filtering.addFilter(field, value).then(this.applyFilters);
            };

            this.removeFilter = function (field) {
                self.filtering.removeFilter(field).then(this.applyFilters);
            };

            this.search = function () {
                this.list.filter = {
                    _string: this.searchForm.searchQuery
                };

                this.list.update();
            };
            this.addFilterValue = function (field, value) {
                var filterDef = self.filtering.filterDefs[field];
                var filter = self.filtering.activeFilters[field];
                var date;

                if (filter && filter.value) {
                    if (filterDef.type === 'list') {
                        if (_.pluck(filter.value, 'text').indexOf(value) === -1) {
                            filter.value.push({
                                text: value
                            });
                        }
                    } else if (filterDef.type === 'date') {
                        date = moment(value);
                        self.filtering.activeFilters[field] = {
                            value: {
                                from: date.hour(0).minutes(0).seconds(0).toDate(),
                                to: date.hour(23).minutes(59).seconds(59).toDate()
                            }
                        };
                    } else {
                        filter.value = value;
                    }
                } else {
                    if (filterDef.type === 'list') {
                        self.filtering.activeFilters[field] = {
                            value: [{
                                text: value
                            }]
                        };
                    } else if (filterDef.type === 'date') {
                        date = moment(value);
                        self.filtering.activeFilters[field] = {
                            value: {
                                from: date.hour(0).minutes(0).seconds(0).toDate(),
                                to: date.hour(23).minutes(59).seconds(59).toDate()
                            }
                        };
                    } else {
                        self.filtering.activeFilters[field] = {
                            value: value
                        };
                    }
                }

                this.filter();
            };

            this.filterByStatus = function(status) {
                self.filtering.clearFilters()
                    .then(function(){
                        self.addFilterValue('status', status);
                    });
            };

            this.filterByNewAndUpdated = function() {
                self.filtering.clearFilters()
                    .then(function(){
                        self.addFilterValue('status', 'New');
                        self.addFilterValue('status', 'Updated');
                    });
            };

            this.filterBySeverity = function(numericSev) {
                self.addFilterValue('severity', Severity.values[numericSev]);
            };

            this.sortBy = function(sort) {
                self.list.sort = sort;
                self.list.update();
                self.filtering.setSort(sort);
            };

            this.sortByField = function(field) {
                var currentSort = Array.isArray(this.filtering.context.sort) ? this.filtering.context.sort[0] : this.filtering.context.sort;
                var sort = null;

                if(currentSort.substr(1) !== field) {
                    sort = ['+' + field];
                } else {
                    sort = [(currentSort === '+' + field) ? '-'+field : '+'+field];
                }

                self.list.sort = sort;
                self.list.update();
                self.filtering.setSort(sort);
            };

            this.getSeverities = self.filtering.getSeverities;

            this.getStatuses = function(query) {
                return AlertingSrv.statuses(query);
            };

            this.getTypes = function(query) {
                return AlertingSrv.types(query);
            };

            this.getSources = function(query) {
                return AlertingSrv.sources(query);
            };

            this.getTags = function(query) {
                return TagSrv.fromAlerts(query);
            };

            self.load();
        });
})();
